"""One IST day's slot grid for an artist and a duration: their hours and days off, lead time, and held ranges.
Shared by the public directory (a service's duration) and quotes (the quoted duration)."""

import uuid
from datetime import date, datetime, timedelta
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.artist import schedule_service as artist_schedule
from app.artist.constants import DEFAULT_CLOSE_HOUR, DEFAULT_OPEN_HOUR
from app.booking import rules
from app.booking.repository import BookingRepository


def open_hours_from(day: date, saved: dict[int, dict[str, Any]], off: set[date]) -> rules.OpenHours:
    """The same answer open_hours gives, read from a preloaded week of hours and days off: None on a day off
    or a closed weekday, the saved hours when set, the platform default otherwise."""
    if day in off:
        return None
    row = saved.get(day.weekday())
    if row is None:
        return DEFAULT_OPEN_HOUR, DEFAULT_CLOSE_HOUR
    return (row["open_hour"], row["close_hour"]) if row["is_open"] else None


def slot_grid(
    day: date, hours: rules.OpenHours, duration_minutes: int, now: datetime, busy: list[tuple[datetime, datetime]]
) -> list[dict[str, Any]]:
    """The pure half of day_slots: mark every slot start against lead time and these held ranges."""
    length = timedelta(minutes=duration_minutes)
    return [
        {
            "start_at": s,
            "available": rules.is_after_lead_time(s, now)
            and not any(b_start < s + length and b_end > s for b_start, b_end in busy),
        }
        for s in rules.slot_starts(day, hours, duration_minutes)
    ]


async def day_slots(
    session: AsyncSession, artist_id: uuid.UUID, day: date, duration_minutes: int, now: datetime
) -> dict[str, Any]:
    """`{date, slots: [{start_at, available}]}`; no slots on a closed weekday or a day off."""
    rules.check_bookable_day(day, now)
    hours = await artist_schedule.open_hours(session, artist_id, day)
    starts = rules.slot_starts(day, hours, duration_minutes)
    if not starts:
        return {"date": day, "slots": []}
    length = timedelta(minutes=duration_minutes)
    busy = await BookingRepository(session).busy_ranges(artist_id, starts[0], starts[-1] + length, now)
    return {"date": day, "slots": slot_grid(day, hours, duration_minutes, now, busy)}
