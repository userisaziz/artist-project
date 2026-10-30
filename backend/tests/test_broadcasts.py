"""Admin broadcasts: segments + filters resolve the exact audience; an artist-only filter narrows
`all_users`/`all_customers` to artists; city/status/category/join-date filters behave as specified."""

from contextlib import asynccontextmanager
from datetime import UTC, datetime

import pytest_asyncio
import sqlalchemy as sa
from sqlalchemy import func, select

from app.notification.broadcast import recipient_query
from app.notification.push import ConsolePushProvider
from app.notification.schemas import BroadcastFilters
from tests.conftest import TestSessionFactory
from tests.support.artist import approved_artist, complete_profile
from tests.support.auth import admin_headers, sign_in
from tests.support.catalog import categories, seed_categories


@pytest_asyncio.fixture(autouse=True)
async def categories_seeded(engine):
    await seed_categories(engine)
    ConsolePushProvider.sent.clear()


@asynccontextmanager
async def db_session():
    async with TestSessionFactory() as session:
        yield session


async def audience_size(session, segment: str, **filters) -> int:
    query = recipient_query(segment, BroadcastFilters(**filters))
    return (await session.scalar(select(func.count()).select_from(query.subquery()))) or 0


async def test_segments_resolve_role_grants(client, engine):
    await admin_headers(client, engine)  # admin grant only: never a broadcast recipient
    await sign_in(client, "+919845070001")  # artist role
    await sign_in(client, "+919845080001", role="customer")

    async with db_session() as session:
        assert await audience_size(session, "all_users") == 2
        assert await audience_size(session, "all_artists") == 1
        assert await audience_size(session, "all_customers") == 1


async def test_artist_status_defaults_to_approved(client, engine):
    admin = await admin_headers(client, engine)
    await approved_artist(client, engine, "+919845070001", admin)
    pending = await sign_in(client, "+919845070002")
    await complete_profile(client, pending)
    await client.post("/api/v1/artists/me/submit", headers=pending)

    async with db_session() as session:
        assert await audience_size(session, "all_artists") == 1  # default: approved only
        assert await audience_size(session, "all_artists", artist_status="pending") == 1
        assert await audience_size(session, "all_artists", artist_status="draft") == 0


async def test_city_filter(client, engine):
    admin = await admin_headers(client, engine)
    await approved_artist(client, engine, "+919845070001", admin, city="Bangalore")
    await approved_artist(client, engine, "+919845070002", admin, city="Pune", name="Pune Henna Studio")

    async with db_session() as session:
        assert await audience_size(session, "all_artists", city="Bangalore") == 1
        assert await audience_size(session, "all_artists", city="Surat") == 0


async def test_category_filter_matches_the_chosen_category_or_its_subcategories(client, engine):
    admin = await admin_headers(client, engine)
    await approved_artist(client, engine, "+919845070001", admin)  # Bridal Classic under Mehendi › Bridal
    cats = await categories(client)
    async with engine.begin() as conn:
        bridal = await conn.scalar(sa.text("SELECT id FROM catalog_category WHERE slug = 'mehendi-bridal'"))

    async with db_session() as session:
        assert await audience_size(session, "all_artists", category_id=bridal) == 1
        assert await audience_size(session, "all_artists", category_id=cats["mehendi"]) == 1  # parent of Bridal
        assert await audience_size(session, "all_artists", category_id=cats["makeup"]) == 0


async def test_join_date_range_is_inclusive(client, engine):
    await admin_headers(client, engine)
    await sign_in(client, "+919845070001")  # every account here is created today
    today = datetime.now(UTC).date().isoformat()  # server timestamps are UTC

    async with db_session() as session:
        assert await audience_size(session, "all_artists", joined_from=today) == 1
        assert await audience_size(session, "all_artists", joined_to="2020-01-01") == 0
        assert await audience_size(session, "all_artists", joined_from="2020-01-01", joined_to=today) == 1


async def test_artist_only_filters_narrow_the_segment_to_artists(client, engine):
    admin = await admin_headers(client, engine)
    await approved_artist(client, engine, "+919845070001", admin)
    await sign_in(client, "+919845080001", role="customer")

    async with db_session() as session:
        # city silently narrows all_users to the artist holding it
        assert await audience_size(session, "all_users", city="Bangalore") == 1
        assert await audience_size(session, "all_customers", city="Bangalore") == 0
