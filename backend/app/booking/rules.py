"""Pure booking rules: pricing, bookable IST slots and refunds. No database, so they're easy to reason about."""

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from app.booking.config import get_booking_settings
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
    s = get_booking_settings()
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
    if day < today or day > today + timedelta(days=get_booking_settings().booking_horizon_days):
        raise ValidationError("Pick a date within the next two months")


# (open_hour, close_hour) of one IST day, whole hours (close may be 24); None when the artist isn't working.
OpenHours = tuple[int, int] | None


def slot_starts(day: date, hours: OpenHours, duration_minutes: int) -> list[datetime]:
    """Hourly starts for one IST day: from opening, as long as the service is over by closing."""
    if hours is None:
        return []
    open_hour, close_hour = hours
    closing = datetime.combine(day, time(), tzinfo=IST) + timedelta(hours=close_hour)
    length = timedelta(minutes=duration_minutes)
    starts = (datetime.combine(day, time(hour), tzinfo=IST) for hour in range(open_hour, close_hour))
    return [s for s in starts if s + length <= closing]


def is_after_lead_time(start: datetime, now: datetime) -> bool:
    return start >= now + timedelta(hours=get_booking_settings().booking_lead_hours)


def start_day(start: datetime) -> date:
    """The IST date of a requested start; rejects naive or unrepresentable times."""
    if start.tzinfo is None:
        raise ValidationError("start_at needs a timezone")
    try:
        return start.astimezone(IST).date()
    except OverflowError as exc:  # e.g. year 9999 plus the IST offset
        raise ValidationError("Pick one of the offered times") from exc


def check_bookable_start(start: datetime, now: datetime, hours: OpenHours, duration_minutes: int) -> None:
    """A start the slot grid would offer: on the hour, within the artist's hours that day, in range, and far
    enough ahead. `hours` are the artist's for the start's IST date."""
    day = start_day(start)
    check_bookable_day(day, now)
    if start.astimezone(IST) not in slot_starts(day, hours, duration_minutes):
        raise ValidationError("Pick one of the offered times")
    if not is_after_lead_time(start, now):
        raise ValidationError("That time is too soon. Pick a later slot.")


def customer_refund_due(start: datetime, now: datetime) -> bool:
    return start - now >= timedelta(hours=get_booking_settings().free_cancel_hours)


def accept_deadline(now: datetime, start: datetime) -> datetime:
    """The artist's window to answer, but never past the start: an unanswered request can't hold a slot that began."""
    return min(now + timedelta(hours=get_booking_settings().booking_accept_hours), start)


def reschedule_deadline(now: datetime, current_start: datetime, new_start: datetime) -> datetime:
    """The artist's window to answer a move, but never past either time: by then the question is moot."""
    return min(accept_deadline(now, new_start), current_start)


CALENDAR_RANGE = timedelta(days=3 * 366)


def check_calendar_day(day: date, now: datetime) -> None:
    """Calendar filters stay within a few years, so date arithmetic can't overflow."""
    today = ist_today(now)
    if not today - CALENDAR_RANGE <= day <= today + CALENDAR_RANGE:
        raise ValidationError("Pick a date within three years")
