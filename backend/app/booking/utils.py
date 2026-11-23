"""Pure booking helpers: codes, reasons, month arithmetic, and whether a move is awaiting an answer."""

import secrets
from datetime import date, datetime, time

from app.booking import rules
from app.booking.models import Booking
from app.shared.enums import BookingStatus

CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no 0/O or 1/I


def new_code() -> str:
    return "BK-" + "".join(secrets.choice(CODE_ALPHABET) for _ in range(6))


def reschedule_pending(booking: Booking, now: datetime) -> bool:
    expires = booking.reschedule_expires_at
    return booking.status == BookingStatus.confirmed and expires is not None and expires > now


def clean_reason(reason: str | None) -> str | None:
    return (reason or "").strip() or None


def shift_month(first: date, by: int) -> date:
    """The first day of the month `by` months from `first` (a first of the month)."""
    index = first.year * 12 + first.month - 1 + by
    return date(index // 12, index % 12 + 1, 1)


def ist_month_start(now: datetime) -> datetime:
    local = now.astimezone(rules.IST)
    return datetime.combine(date(local.year, local.month, 1), time(), tzinfo=rules.IST)
