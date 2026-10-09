"""Contract test: the test database must carry the full 10-table schema.

Migrations are applied session-start in conftest (sync, because alembic's env.py
uses asyncio.run). Here we only verify the result: every table the models and
services rely on exists in the test DB.
"""

import sqlalchemy as sa

EXPECTED_TABLES = {
    "users", "customer_profiles", "artist_profiles", "artist_services", "service_inclusions",
    "service_addons", "artist_availability", "artist_policies", "otp_codes", "refresh_tokens",
    "alembic_version",
}


async def test_migrations_create_all_tables(engine):
    async with engine.connect() as conn:
        rows = (await conn.execute(sa.text(
            "SELECT tablename FROM pg_tables WHERE schemaname='public'"
        ))).scalars().all()
    assert EXPECTED_TABLES <= set(rows)
