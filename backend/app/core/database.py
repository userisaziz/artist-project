"""Async engine + session factory.

One engine for the whole process (shared connection pool, sized from settings, disposed on
shutdown by the app lifespan). `get_db` is the dependency every route uses: it owns the
transaction — commit when the request succeeds, rollback when anything raises — so services
never manage sessions.

Always depend on it as `Depends(get_db, scope="function")`: the commit then runs before the response
is sent, so a client never gets 200/201 for a write that failed to commit (FastAPI's default
"request" scope would commit only after the response went out). tests/test_platform.py checks this.
"""

from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings

settings = get_settings()
engine = create_async_engine(
    settings.database_url,
    pool_pre_ping=True,
    pool_size=settings.db_pool_size,
    max_overflow=settings.db_max_overflow,
    pool_recycle=settings.db_pool_recycle_seconds,
    pool_timeout=10,
    # A runaway query is cancelled by Postgres instead of holding a connection forever.
    connect_args={"server_settings": {"statement_timeout": str(settings.db_statement_timeout_ms)}},
)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def get_db() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
