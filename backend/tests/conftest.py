"""Test harness: real Postgres (art_circle_test), real app, no network.

The app's `get_db` dependency is overridden with a session bound to the test
engine — everything else (routing, services, SQL) runs for real.
"""

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.config import get_settings
from app.core.database import get_db
from app.main import create_app

settings = get_settings()
test_engine = create_async_engine(settings.test_database_url)
TestSessionFactory = async_sessionmaker(test_engine, expire_on_commit=False)


@pytest_asyncio.fixture(scope="session")
async def engine():
    yield test_engine
    await test_engine.dispose()


@pytest_asyncio.fixture(scope="session")
async def client(engine):
    app = create_app()

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
