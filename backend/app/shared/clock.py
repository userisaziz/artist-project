"""The one place "now" comes from, so tests can move time (booking expiry, slot lead time, refunds)."""

from datetime import UTC, datetime


def now() -> datetime:
    return datetime.now(UTC)
