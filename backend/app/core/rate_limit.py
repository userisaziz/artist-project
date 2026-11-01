"""Fixed-window rate limits. Two backends, same window semantics.

The Postgres bucket (the default) keeps one row per key (e.g. `otp_request:ip:203.0.113.7`);
a single atomic upsert counts the hit and starts a fresh window once the old one has passed.
Counts are committed straight away, so a request that later fails (wrong OTP, validation error)
still uses up its allowance. Because the row lives in the database, every worker process shares
the counter.

The in-process bucket counts in memory instead. It is used for the public read endpoints, where
a database round trip per request costs far more than the limit is worth: the database sits
hundreds of milliseconds away, and a read that only wanted to be counted was spending an INSERT
plus a COMMIT to do it. Counters there are per process, so the effective allowance scales with the
number of workers — fine for an abuse ceiling, not for a quota.
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
    count, started = await _pg_hit(session, key, limit, now)
    _reject_over_allowance(count, started, limit, now)


async def _pg_hit(session: AsyncSession, key: str, limit: Limit, now: datetime) -> tuple[int, datetime]:
    window = timedelta(seconds=limit.window_seconds)
    count, started = (await session.execute(HIT_SQL, {"key": key, "now": now, "window_start": now - window})).one()
    await session.commit()
    return count, started


def _reject_over_allowance(count: int, started: datetime, limit: Limit, now: datetime) -> None:
    if count > limit.hits:
        window = timedelta(seconds=limit.window_seconds)
        retry_after = max(1, int((started + window - now).total_seconds()))
        raise RateLimitError("Too many requests. Please try again later.", headers={"Retry-After": str(retry_after)})


class _InProcessWindows:
    """The same fixed windows as HIT_SQL, kept in a dict instead of a table.

    A hit costs a dictionary lookup. The rows of the two backends line up one to one — (window
    started at, hits so far) per key — so the semantics stay identical; only the round trip goes away."""

    def __init__(self) -> None:
        self._windows: dict[str, tuple[datetime, int]] = {}

    def hit(self, key: str, limit: Limit, now: datetime) -> tuple[int, datetime]:
        started, count = self._windows.get(key, (now, 0))
        if started <= now - timedelta(seconds=limit.window_seconds):
            started, count = now, 1  # the old window has passed: this hit starts a fresh one
        else:
            count += 1
        self._windows[key] = (started, count)
        return count, started

    def clear(self) -> None:
        self._windows.clear()


_in_process = _InProcessWindows()


def reset_in_process_buckets() -> None:
    """Forget every in-process counter. Tests truncate the Postgres buckets between runs; this is the
    same reset for the in-memory backend, which outlives a TRUNCATE."""
    _in_process.clear()


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


def limit_by_ip_in_memory(scope: str, get_limit: Callable[..., Limit]):
    """Route dependency: at most `get_limit()` hits per client IP for `scope`, counted in-process.

    The public read endpoints use this: they answer from the database anyway, and paying an INSERT
    plus a COMMIT just to count the read costs more than the limit is worth. Counters live per
    worker process, so the effective allowance scales with the number of workers — an abuse
    ceiling, not a quota. Shares `get_limit` with the Postgres flavor, so tests override it the same way.
    """

    async def dependency(
        request: Request,
        limit: Limit = Depends(get_limit),
        clock: Clock = Depends(get_clock),
    ) -> None:
        now = clock.now()
        count, started = _in_process.hit(f"{scope}:ip:{client_ip(request)}", limit, now)
        _reject_over_allowance(count, started, limit, now)

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
