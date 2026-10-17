"""Test harness: real Postgres (art_circle_test), real app, no network.

The app's `get_db` dependency is overridden with a session bound to the test
engine — everything else (routing, services, SQL) runs for real.
"""

import os

# Tests never touch a real SMS gateway, image host or payment, whatever .env says.
# Must precede the cached settings getters.
os.environ["ENVIRONMENT"] = "test"
os.environ["SMS_PROVIDER"] = "console"
os.environ["FAST2SMS_API_KEY"] = ""
os.environ["STORAGE_PROVIDER"] = "fake"
os.environ["PAYMENT_PROVIDER"] = "mock"
# Fixed Fernet key for tests (32 zero bytes, base64) — never used outside the test DB.
os.environ["AADHAAR_ENCRYPTION_KEY"] = "MDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA="

import pytest
import pytest_asyncio
from alembic.command import upgrade
from alembic.config import Config
from httpx import ASGITransport, AsyncClient
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.database import get_db
from app.main import create_app
from app.registry import Base


class DatabaseSettingsForTests(BaseSettings):
    """Test-only configuration: the app's own settings never know about the test database."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    test_database_url: str


settings = DatabaseSettingsForTests()


def apply_migrations(url: str) -> None:
    """Run alembic to head. Sync on purpose: env.py uses asyncio.run, so this
    must happen before pytest-asyncio opens an event loop."""
    cfg = Config("alembic.ini")
    cfg.set_main_option("sqlalchemy.url", url)
    upgrade(cfg, "head")


@pytest.fixture(scope="session", autouse=True)
def migrated():
    apply_migrations(settings.test_database_url)


test_engine = create_async_engine(settings.test_database_url)
TestSessionFactory = async_sessionmaker(test_engine, expire_on_commit=False)


@pytest_asyncio.fixture(scope="session")
async def engine(migrated):
    yield test_engine
    await test_engine.dispose()


@pytest_asyncio.fixture(scope="session")
async def app(engine):
    return create_app()


@pytest.fixture
def override(app):
    """`override(dependency, replacement)` for one test; every override is removed afterwards."""
    added = []

    def apply(dependency, replacement):
        app.dependency_overrides[dependency] = replacement
        added.append(dependency)

    yield apply
    for dependency in added:
        app.dependency_overrides.pop(dependency, None)


@pytest_asyncio.fixture(scope="session")
async def client(app):

    async def override_get_db():
        async with TestSessionFactory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


TABLES = ", ".join(sorted(Base.metadata.tables))


@pytest_asyncio.fixture(autouse=True)
async def clean_db(engine):
    yield
    from app.auth.sms import ConsoleSMSProvider

    ConsoleSMSProvider.sent.clear()
    async with engine.begin() as conn:
        await conn.execute(text(f"TRUNCATE {TABLES} RESTART IDENTITY CASCADE"))
