"""Housekeeping, safe to run as often as you like: `python -m scripts.maintenance` (from backend/).

Run it from a scheduler (cron, a Kubernetes CronJob, ...) every few minutes. It deletes rows that can
never matter again: used or expired sign-in codes, dead refresh tokens past their lifetime, and
rate-limit windows that have closed. Nothing here is needed for correctness; the API already ignores
these rows, so a missed run only costs disk space.

It also sends profile-requirement notices (a warning, then "your profile is hidden"), each once per artist; a
missed run only delays them, because being on hold is worked out from the data, not from the notices.
"""

import asyncio
import logging
from datetime import timedelta
from typing import cast

from sqlalchemy import CursorResult, delete, or_

from app.auth.models import OtpCode, RefreshToken
from app.core.config import get_settings
from app.core.database import SessionLocal, engine
from app.core.logging import configure_logging
from app.core.rate_limit import RateLimitBucket
from app.requirement.service import RequirementService
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
    counts = (cast(CursorResult, result).rowcount for result in (otps, tokens, buckets))
    return dict(zip(("otp_codes", "refresh_tokens", "rate_limit_buckets"), counts, strict=True))


async def send_requirement_notices(clock: Clock = SYSTEM_CLOCK) -> dict[str, int]:
    async with SessionLocal() as session:
        sent = await RequirementService(session, clock).send_notices()
        await session.commit()
    # The stages are literal keys; the report hands out plain strings.
    return {str(stage): count for stage, count in sent.items()}


async def main() -> None:
    settings = get_settings()
    configure_logging(settings.log_level, settings.use_json_logs)
    try:
        deleted = await prune()
        notices = await send_requirement_notices()
        logger.info("maintenance done", extra={"deleted": deleted, "requirement_notices": notices})
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
