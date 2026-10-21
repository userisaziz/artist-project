"""An artist's schedule: weekly working hours, days off and a display-only travel radius.

A weekday without a saved row uses the default hours, so artists who never set hours work every day
08:00-20:00 IST. A day off only stops new bookings; bookings already made for that date stay."""

import uuid
from datetime import date
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.artist.constants import DEFAULT_CLOSE_HOUR, DEFAULT_OPEN_HOUR, WEEKDAYS
from app.artist.models import ArtistProfile, ArtistWorkingHour
from app.artist.repository import ArtistRepository, ScheduleRepository
from app.artist.schemas import ScheduleIn
from app.booking import rules
from app.core.exceptions import NotFoundError
from app.shared.clock import Clock
from app.user.models import User


def _default_day(weekday: int) -> dict[str, Any]:
    return {"weekday": weekday, "is_open": True, "open_hour": DEFAULT_OPEN_HOUR, "close_hour": DEFAULT_CLOSE_HOUR}


def _day(row: ArtistWorkingHour) -> dict[str, Any]:
    return {"weekday": row.weekday, "is_open": row.is_open, "open_hour": row.open_hour, "close_hour": row.close_hour}


async def week(session: AsyncSession, artist_id: uuid.UUID) -> list[dict[str, Any]]:
    """All seven weekdays, Monday first, saved hours over the defaults."""
    saved = {row.weekday: _day(row) for row in await ScheduleRepository(session).hours(artist_id)}
    return [saved.get(weekday, _default_day(weekday)) for weekday in range(WEEKDAYS)]


async def open_hours(session: AsyncSession, artist_id: uuid.UUID, day: date) -> rules.OpenHours:
    """The artist's (open, close) hours on one IST date, or None on a closed weekday or a day off."""
    schedule = ScheduleRepository(session)
    if await schedule.is_day_off(artist_id, day):
        return None
    row = await schedule.hour(artist_id, day.weekday())
    if row is None:
        return DEFAULT_OPEN_HOUR, DEFAULT_CLOSE_HOUR
    return (row.open_hour, row.close_hour) if row.is_open else None


class ScheduleService:
    """The signed-in artist's own schedule. Any artist with a profile may edit it, whatever its review status,
    so hours can be set during onboarding and survive reopening an approved profile."""

    def __init__(self, session: AsyncSession, clock: Clock):
        self.session = session
        self.clock = clock
        self.artists = ArtistRepository(session)
        self.schedule = ScheduleRepository(session)

    async def _profile(self, user: User) -> ArtistProfile:
        profile = await self.artists.by_user(user.id)
        if profile is None:
            raise NotFoundError("No artist profile yet")
        return profile

    async def _out(self, profile: ArtistProfile) -> dict[str, Any]:
        today = rules.ist_today(self.clock.now())
        return {
            "hours": await week(self.session, profile.id),
            "days_off": await self.schedule.days_off(profile.id, today),
            "travel_radius_km": profile.travel_radius_km,
        }

    async def get(self, user: User) -> dict[str, Any]:
        return await self._out(await self._profile(user))

    async def save(self, user: User, body: ScheduleIn) -> dict[str, Any]:
        profile = await self._profile(user)
        rows = [
            ArtistWorkingHour(
                artist_id=profile.id,
                weekday=h.weekday,
                is_open=h.is_open,
                open_hour=h.open_hour,
                close_hour=h.close_hour,
            )
            for h in body.hours
        ]
        await self.schedule.replace_hours(profile.id, rows)
        profile.travel_radius_km = body.travel_radius_km
        await self.session.flush()
        return await self._out(profile)

    async def add_day_off(self, user: User, day: date) -> dict[str, Any]:
        """Today (IST) up to the booking horizon. Idempotent."""
        profile = await self._profile(user)
        rules.check_bookable_day(day, self.clock.now())
        await self.schedule.add_day_off(profile.id, day)
        return await self._out(profile)

    async def remove_day_off(self, user: User, day: date) -> dict[str, Any]:
        """Idempotent: removing a day that isn't off changes nothing."""
        profile = await self._profile(user)
        await self.schedule.remove_day_off(profile.id, day)
        return await self._out(profile)
