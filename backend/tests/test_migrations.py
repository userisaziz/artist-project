"""Contract test: the test database must carry the full schema.

Migrations are applied session-start in conftest (sync, because alembic's env.py
uses asyncio.run). Here we verify the result, the defaults existing rows get,
and that the newest migration downgrades and upgrades cleanly.
"""

import pytest
import sqlalchemy as sa
from alembic.command import downgrade, upgrade
from alembic.config import Config

from app.core.config import get_settings
from tests.conftest import test_engine
from tests.test_artists import categories, seed_categories, sign_in

EXPECTED_TABLES = {
    "users", "otp_codes", "refresh_tokens", "alembic_version",
    "categories", "artist_profiles", "artist_categories", "artist_services", "portfolio_photos",
    "artist_kyc", "aadhaar_reveals", "service_templates", "bookings",
}


async def test_migrations_create_all_tables(engine):
    async with engine.connect() as conn:
        rows = (await conn.execute(sa.text(
            "SELECT tablename FROM pg_tables WHERE schemaname='public'"
        ))).scalars().all()
    assert EXPECTED_TABLES <= set(rows)


async def test_existing_services_become_approved_custom_rows(client, engine):
    """Rows written before migration #6 carry no template or status: they read as approved custom services."""
    await seed_categories(engine)
    headers = await sign_in(client, "+919845070001")
    cats = await categories(client)
    profile = (await client.put("/api/v1/artists/me/profile", headers=headers, json={
        "business_name": "A", "city": "Pune", "category_ids": [cats["mehendi"]],
    })).json()
    async with engine.begin() as conn:
        await conn.execute(sa.text(
            "INSERT INTO artist_services (artist_id, category_id, name, price_paise, duration_minutes, sort_order) "
            "VALUES (:a, :c, 'Old service', 100, 30, 0)"
        ), {"a": profile["id"], "c": cats["mehendi"]})
        row = (await conn.execute(sa.text("SELECT status, template_id, name FROM artist_services"))).one()
    assert tuple(row) == ("approved", None, "Old service")

    with pytest.raises(sa.exc.IntegrityError):  # a row needs a template or its own name
        async with engine.begin() as conn:
            await conn.execute(sa.text(
                "INSERT INTO artist_services (artist_id, category_id, price_paise, duration_minutes, sort_order) "
                "VALUES (:a, :c, 100, 30, 1)"
            ), {"a": profile["id"], "c": cats["mehendi"]})


def test_catalog_migration_round_trips():
    """Sync on purpose: alembic's env.py calls asyncio.run."""
    cfg = Config("alembic.ini")
    cfg.set_main_option("sqlalchemy.url", get_settings().test_database_url)
    downgrade(cfg, "d8e2a6b4c1f9")
    upgrade(cfg, "head")
    # The enum type was dropped and recreated with a new OID; pooled asyncpg connections cache the old one.
    # Drop the pool without closing (closing needs the event loop) so later tests get fresh connections.
    test_engine.sync_engine.dispose(close=False)
