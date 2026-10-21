"""One IST day's slot grid for an artist and a duration: their hours and days off, lead time, and held ranges.
Shared by the public directory (a service's duration) and quotes (the quoted duration)."""

import uuid
from datetime import date, datetime, timedelta
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.artist import schedule_service as artist_schedule
from app.booking import rules
from app.booking.repository import BookingRepository


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
    return {
        "date": day,
        "slots": [
            {
                "start_at": s,
                "available": rules.is_after_lead_time(s, now)
                and not any(b_start < s + length and b_end > s for b_start, b_end in busy),
            }
            for s in starts
        ],
    }
