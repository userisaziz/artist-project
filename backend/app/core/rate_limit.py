"""Fixed-window rate limits stored in Postgres, so every worker process shares the same counters.

One row per key (e.g. `otp_request:ip:203.0.113.7`); a single atomic upsert counts the hit and
starts a fresh window once the old one has passed. Counts are committed straight away, so a
request that later fails (wrong OTP, validation error) still uses up its allowance.
"""

from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timedelta

from fastapi import Depends, Request
from sqlalchemy import DateTime, Integer, String, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import get_db
from app.core.exceptions import RateLimitError
from app.shared.clock import Clock, get_clock
from app.shared.models import Base

HIT_SQL = text(
    """
    INSERT INTO core_rate_limit_bucket AS b (key, window_started_at, hit_count)
    VALUES (:key, :now, 1)
    ON CONFLICT (key) DO UPDATE SET
        hit_count = CASE WHEN b.window_started_at <= :window_start THEN 1 ELSE b.hit_count + 1 END,
        window_started_at = CASE WHEN b.window_started_at <= :window_start THEN :now ELSE b.window_started_at END
    RETURNING hit_count, window_started_at
    """
)


class RateLimitBucket(Base):
    __tablename__ = "core_rate_limit_bucket"

    key: Mapped[str] = mapped_column(String(200), primary_key=True)
    window_started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    hit_count: Mapped[int] = mapped_column(Integer, nullable=False)


@dataclass(frozen=True)
class Limit:
    hits: int
    window_seconds: int


async def hit(session: AsyncSession, key: str, limit: Limit, now: datetime) -> None:
    """Count one hit on `key`; 429 `rate_limited` with Retry-After once the window's allowance is used."""
    window = timedelta(seconds=limit.window_seconds)
    count, started = (await session.execute(HIT_SQL, {"key": key, "now": now, "window_start": now - window})).one()
    await session.commit()
    if count > limit.hits:
        retry_after = max(1, int((started + window - now).total_seconds()))
        raise RateLimitError("Too many requests. Please try again later.", headers={"Retry-After": str(retry_after)})


def client_ip(request: Request) -> str:
    """The caller's address. Behind a proxy, uvicorn's --proxy-headers sets it from X-Forwarded-For."""
    return request.client.host if request.client else "unknown"


def limit_by_ip(scope: str, get_limit: Callable[..., Limit]):
    """Route dependency: at most `get_limit()` hits per client IP for `scope`.

    `get_limit` is itself a dependency (usually reading module settings), so tests can override it.
    """

    async def dependency(
        request: Request,
        limit: Limit = Depends(get_limit),
        session: AsyncSession = Depends(get_db, scope="function"),
        clock: Clock = Depends(get_clock),
    ) -> None:
        await hit(session, f"{scope}:ip:{client_ip(request)}", limit, clock.now())

    return dependency


def limit_by_user(scope: str, get_limit: Callable[..., Limit]):
    """Route dependency: at most `get_limit()` hits per signed-in user for `scope`."""
    from app.core.auth import get_current_user  # core.auth imports the user model; keep this module light
    from app.user.models import User

    async def dependency(
        user: User = Depends(get_current_user),
        limit: Limit = Depends(get_limit),
        session: AsyncSession = Depends(get_db, scope="function"),
        clock: Clock = Depends(get_clock),
    ) -> None:
        await hit(session, f"{scope}:user:{user.id}", limit, clock.now())

    return dependency
