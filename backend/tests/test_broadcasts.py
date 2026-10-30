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


ADMIN = "/api/v1/admin/broadcasts"


async def test_preview_matches_send_and_records_history(client, engine):
    admin = await admin_headers(client, engine)
    await sign_in(client, "+919845070001")  # artist
    customer = await sign_in(client, "+919845080001", role="customer")
    await client.post(
        "/api/v1/notifications/devices", headers=customer, json={"token": "ExponentPushToken[cust]", "platform": "ios"}
    )

    preview = await client.post(f"{ADMIN}/preview", headers=admin, json={"segment": "all_users", "filters": {}})
    sent = await client.post(
        ADMIN, headers=admin, json={"segment": "all_users", "filters": {}, "title": "Hello", "body": "We are live."}
    )

    assert preview.status_code == 200, preview.text
    assert preview.json() == {"recipients": 2, "with_push": 1}
    assert sent.status_code == 201, sent.text
    assert (sent.json()["recipients"], sent.json()["with_push"]) == (2, 1)

    async with engine.begin() as conn:
        inbox_rows = (await conn.execute(sa.text("SELECT kind, title, link FROM notification"))).all()
        broadcast_row = (
            await conn.execute(sa.text("SELECT segment, recipient_count, push_count FROM notification_broadcast"))
        ).one()
    assert set(inbox_rows) == {("announcement", "Hello", None)}
    assert len(inbox_rows) == 2  # one per recipient, none for the admin
    assert broadcast_row == ("all_users", 2, 1)
    assert [m["to"] for m in ConsolePushProvider.sent] == ["ExponentPushToken[cust]"]
    assert ConsolePushProvider.sent[0]["data"] == {"kind": "announcement", "link": None}


async def test_customers_cannot_touch_broadcasts(client, engine):
    customer = await sign_in(client, "+919845080001", role="customer")

    preview = await client.post(f"{ADMIN}/preview", headers=customer, json={"segment": "all_users"})
    sent = await client.post(ADMIN, headers=customer, json={"segment": "all_users", "title": "Hi", "body": "There"})
    history = await client.get(ADMIN, headers=customer)

    for response in (preview, sent, history):
        assert response.status_code == 403
        assert response.json()["code"] == "forbidden"


async def test_sending_to_an_empty_audience_is_rejected(client, engine):
    admin = await admin_headers(client, engine)

    response = await client.post(
        ADMIN,
        headers=admin,
        json={"segment": "all_customers", "filters": {"city": "Surat"}, "title": "Hello", "body": "Nobody"},
    )

    assert response.status_code == 422
    assert response.json()["code"] == "validation_error"


async def test_history_is_newest_first_with_cursor_pages(client, engine):
    admin = await admin_headers(client, engine)
    await sign_in(client, "+919845070001")
    for i in (1, 2, 3):
        await client.post(
            ADMIN, headers=admin, json={"segment": "all_artists", "filters": {}, "title": f"Note {i}", "body": "Body"}
        )

    first = (await client.get(f"{ADMIN}?limit=2", headers=admin)).json()
    second = (await client.get(f"{ADMIN}?limit=2&cursor={first['next_cursor']}", headers=admin)).json()

    assert [b["title"] for b in first["items"]] == ["Note 3", "Note 2"]
    assert [b["title"] for b in second["items"]] == ["Note 1"]
    assert second["next_cursor"] is None
    assert (first["items"][0]["recipient_count"], first["items"][0]["push_count"]) == (1, 0)
