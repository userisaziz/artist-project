"""Contract test: the test database must carry the full schema.

Migrations are applied session-start in conftest (sync, because alembic's env.py
uses asyncio.run). Here we verify the result, the defaults existing rows get,
and that the newest migration downgrades and upgrades cleanly.
"""

import pytest
import sqlalchemy as sa
from alembic.command import downgrade, upgrade
from alembic.config import Config

from tests.conftest import settings, test_engine
from tests.support.auth import sign_in
from tests.support.catalog import categories, seed_categories

EXPECTED_TABLES = {
    "user_account",
    "user_role_grant",
    "auth_otp_code",
    "auth_refresh_token",
    "alembic_version",
    "catalog_category",
    "artist_profile",
    "artist_category",
    "artist_service_item",
    "artist_portfolio_photo",
    "artist_kyc",
    "artist_aadhaar_reveal",
    "catalog_service_template",
    "booking",
    "review",
}


async def test_migrations_create_all_tables(engine):
    async with engine.connect() as conn:
        rows = (
            (await conn.execute(sa.text("SELECT tablename FROM pg_tables WHERE schemaname='public'"))).scalars().all()
        )
    assert EXPECTED_TABLES <= set(rows)


async def test_existing_services_become_approved_custom_rows(client, engine):
    """Rows written before migration #6 carry no template or status: they read as approved custom services."""
    await seed_categories(engine)
    headers = await sign_in(client, "+919845070001")
    cats = await categories(client)
    profile = (
        await client.put(
            "/api/v1/artists/me/profile",
            headers=headers,
            json={
                "business_name": "A",
                "city": "Pune",
                "category_ids": [cats["mehendi"]],
            },
        )
    ).json()
    async with engine.begin() as conn:
        await conn.execute(
            sa.text(
                "INSERT INTO artist_service_item (artist_id, category_id, name, price_paise, duration_minutes, sort_order) "
                "VALUES (:a, :c, 'Old service', 100, 30, 0)"
            ),
            {"a": profile["id"], "c": cats["mehendi"]},
        )
        row = (await conn.execute(sa.text("SELECT status, template_id, name FROM artist_service_item"))).one()
    assert tuple(row) == ("approved", None, "Old service")

    with pytest.raises(sa.exc.IntegrityError):  # a row needs a template or its own name
        async with engine.begin() as conn:
            await conn.execute(
                sa.text(
                    "INSERT INTO artist_service_item (artist_id, category_id, price_paise, duration_minutes, sort_order) "
                    "VALUES (:a, :c, 100, 30, 1)"
                ),
                {"a": profile["id"], "c": cats["mehendi"]},
            )


def test_catalog_migration_round_trips():
    """Sync on purpose: alembic's env.py calls asyncio.run."""
    cfg = Config("alembic.ini")
    cfg.set_main_option("sqlalchemy.url", settings.test_database_url)
    downgrade(cfg, "d8e2a6b4c1f9")
    upgrade(cfg, "head")
    # The enum type was dropped and recreated with a new OID; pooled asyncpg connections cache the old one.
    # Drop the pool without closing (closing needs the event loop) so later tests get fresh connections.
    test_engine.sync_engine.dispose(close=False)


def _schema_diff(connection) -> list:
    from alembic.autogenerate import compare_metadata
    from alembic.migration import MigrationContext

    from app.registry import Base

    context = MigrationContext.configure(connection, opts={"compare_type": True})
    return compare_metadata(context, Base.metadata)


async def test_models_and_migrations_agree(engine):
    """`alembic check` in test form: the migrated schema is exactly what the models declare."""
    async with engine.connect() as conn:
        diff = await conn.run_sync(_schema_diff)
    assert diff == []


async def test_every_constraint_and_index_follows_the_naming_convention(engine):
    """Names come from app.shared.models.NAMING_CONVENTION, never Postgres defaults (`*_pkey`, `*_fkey`, `*_key`)."""
    async with engine.connect() as conn:
        constraints = (
            await conn.execute(
                sa.text(
                    "SELECT conrelid::regclass::text, conname, contype::text FROM pg_constraint "
                    "WHERE connamespace = 'public'::regnamespace AND conrelid::regclass::text <> 'alembic_version'"
                )
            )
        ).all()
        indexes = (
            await conn.execute(
                sa.text(
                    "SELECT tablename, indexname FROM pg_indexes WHERE schemaname = 'public' "
                    "AND tablename <> 'alembic_version' AND indexname NOT IN (SELECT conname FROM pg_constraint)"
                )
            )
        ).all()
    prefix = {"p": "pk_", "u": "uq_", "f": "fk_", "c": "ck_"}
    bad = [name for table, name, kind in constraints if not name.startswith(f"{prefix[kind]}{table}")]
    bad += [name for table, name in indexes if not name.startswith((f"ix_{table}_", f"uq_{table}_"))]
    assert bad == []
