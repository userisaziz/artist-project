"""Pure booking rules: pricing, bookable IST slots and refunds. No database, so they're easy to reason about."""

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from app.core.config import get_settings
from app.core.exceptions import ValidationError

IST = ZoneInfo("Asia/Kolkata")


@dataclass(frozen=True)
class Price:
    subtotal_paise: int
    platform_fee_paise: int
    total_paise: int
    deposit_paise: int
    commission_paise: int


def price(subtotal_paise: int) -> Price:
    """Fee unless waived; deposit is a share of the total rounded to whole rupees (half up); commission on the subtotal."""
    s = get_settings()
    fee = 0 if subtotal_paise >= s.platform_fee_waived_from_paise else s.platform_fee_paise
    total = subtotal_paise + fee
    deposit_rupees = (total * s.deposit_percent + 5_000) // 10_000
    commission = (subtotal_paise * s.commission_percent + 50) // 100
    return Price(subtotal_paise, fee, total, deposit_rupees * 100, commission)


def ist_today(now: datetime) -> date:
    return now.astimezone(IST).date()


def ist_day_bounds(first: date, last: date) -> tuple[datetime, datetime]:
    """[start of `first`, start of the day after `last`) in IST."""
    return datetime.combine(first, time(), tzinfo=IST), datetime.combine(last + timedelta(days=1), time(), tzinfo=IST)


def check_bookable_day(day: date, now: datetime) -> None:
    today = ist_today(now)
    if day < today or day > today + timedelta(days=get_settings().booking_horizon_days):
        raise ValidationError("Pick a date within the next two months")


def slot_starts(day: date) -> list[datetime]:
    """Hourly start times for one IST day."""
    s = get_settings()
    return [datetime.combine(day, time(hour), tzinfo=IST) for hour in range(s.slot_first_hour, s.slot_last_hour + 1)]


def is_after_lead_time(start: datetime, now: datetime) -> bool:
    return start >= now + timedelta(hours=get_settings().booking_lead_hours)


def check_bookable_start(start: datetime, now: datetime) -> None:
    """A start the slot grid would offer: on the hour, within slot hours, in range, and far enough ahead."""
    if start.tzinfo is None:
        raise ValidationError("start_at needs a timezone")
    local = start.astimezone(IST)
    check_bookable_day(local.date(), now)
    if local not in slot_starts(local.date()):
        raise ValidationError("Pick one of the offered times")
    if not is_after_lead_time(start, now):
        raise ValidationError("That time is too soon. Pick a later slot.")


def customer_refund_due(start: datetime, now: datetime) -> bool:
    return start - now >= timedelta(hours=get_settings().free_cancel_hours)


def accept_deadline(now: datetime) -> datetime:
    return now + timedelta(hours=get_settings().booking_accept_hours)
