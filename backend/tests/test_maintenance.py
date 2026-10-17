"""Housekeeping deletes only rows that can never matter again."""

from datetime import timedelta

from sqlalchemy import text

from app.shared.clock import SYSTEM_CLOCK, FixedClock
from scripts import maintenance
from tests.support.auth import PHONE, sign_in


async def test_prune_removes_dead_rows_and_keeps_live_ones(client, engine):
    await sign_in(client, PHONE, role=None)  # one live code (consumed) and one live refresh token
    async with engine.begin() as conn:
        await conn.execute(
            text(
                "INSERT INTO core_rate_limit_bucket (key, window_started_at, hit_count) VALUES ('old', now() - interval '2 days', 1), ('new', now(), 1)"
            )
        )
    later = FixedClock(SYSTEM_CLOCK.now() + timedelta(days=2))  # the code is a day past retention
    deleted = await maintenance.prune(later)
    assert (deleted["otp_codes"], deleted["refresh_tokens"]) == (1, 0)
    async with engine.connect() as conn:
        tokens = (await conn.execute(text("SELECT count(*) FROM auth_refresh_token"))).scalar_one()
        buckets = (await conn.execute(text("SELECT count(*) FROM core_rate_limit_bucket"))).scalar_one()
    assert tokens == 1  # still inside its 7-day lifetime
    assert buckets == 0  # every window, including the sign-in's own, closed more than a day before `later`
