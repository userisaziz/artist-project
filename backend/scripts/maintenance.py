"""Housekeeping, safe to run as often as you like: `python -m scripts.maintenance` (from backend/).

Run it from a scheduler (cron, a Kubernetes CronJob, ...) every few minutes. It deletes rows that can
never matter again: used or expired sign-in codes, dead refresh tokens past their lifetime, and
rate-limit windows that have closed. Nothing here is needed for correctness; the API already ignores
these rows, so a missed run only costs disk space.
"""

import asyncio
import logging
from datetime import timedelta

from sqlalchemy import delete, or_

from app.auth.models import OtpCode, RefreshToken
from app.core.config import get_settings
from app.core.database import SessionLocal, engine
from app.core.logging import configure_logging
from app.core.rate_limit import RateLimitBucket
from app.shared.clock import SYSTEM_CLOCK, Clock

logger = logging.getLogger("art_circle.maintenance")

OTP_RETENTION = timedelta(days=1)  # keep a day of codes for support questions
RATE_LIMIT_RETENTION = timedelta(days=1)  # longer than the longest window


async def prune(clock: Clock = SYSTEM_CLOCK) -> dict[str, int]:
    now = clock.now()
    settings = get_settings()
    async with SessionLocal() as session:
        otps = await session.execute(delete(OtpCode).where(OtpCode.created_at < now - OTP_RETENTION))
        tokens = await session.execute(
            delete(RefreshToken).where(
                or_(
                    RefreshToken.expires_at < now,
                    RefreshToken.revoked_at < now - timedelta(days=settings.refresh_token_ttl_days),
                )
            )
        )
        buckets = await session.execute(
            delete(RateLimitBucket).where(RateLimitBucket.window_started_at < now - RATE_LIMIT_RETENTION)
        )
        await session.commit()
    return {"otp_codes": otps.rowcount, "refresh_tokens": tokens.rowcount, "rate_limit_buckets": buckets.rowcount}


async def main() -> None:
    settings = get_settings()
    configure_logging(settings.log_level, settings.use_json_logs)
    try:
        deleted = await prune()
        logger.info("maintenance done", extra={"deleted": deleted})
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
