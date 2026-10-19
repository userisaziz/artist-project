"""Admin settings, phase 1. Booking rules are read from server config (editing them needs a settings store,
later); cities come from the catalog config; the admin team is the set of accounts holding the admin role.
Every change here goes through the audited admin guard."""

import uuid
from datetime import timedelta
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.booking.config import BookingSettings
from app.catalog.config import CatalogSettings
from app.core.exceptions import ConflictError, NotFoundError
from app.platform.repository import PlatformRepository
from app.shared.clock import Clock
from app.shared.enums import UserRole
from app.user.models import User

CITY_WINDOW_DAYS = 30
ALL_CITIES = "All cities"


def member_name(user: User) -> str:
    return " ".join(n for n in (user.first_name, user.last_name) if n) or user.phone


def policies(booking: BookingSettings) -> list[dict[str, Any]]:
    """The booking rules admins need to know, worded for people. No fees or payouts in phase 1."""
    rules = [
        ("booking_accept_hours", "Artist response window", f"{booking.booking_accept_hours} hours to accept a request"),
        ("booking_lead_hours", "Earliest booking", f"{booking.booking_lead_hours} hours from now"),
        ("booking_horizon_days", "Booking horizon", f"Up to {booking.booking_horizon_days} days ahead"),
        (
            "slot_hours",
            "Bookable start times",
            f"{booking.slot_first_hour}:00 to {booking.slot_last_hour}:00 IST, hourly",
        ),
        (
            "max_open_requests_per_customer",
            "Open requests per customer",
            f"At most {booking.max_open_requests_per_customer} unanswered at once",
        ),
        ("payments", "Payments", "Customers pay the artist directly; no in-app payments"),
    ]
    return [{"key": k, "label": label, "value": v, "scope": ALL_CITIES, "editable": False} for k, label, v in rules]


class PlatformService:
    def __init__(self, session: AsyncSession, booking: BookingSettings, catalog: CatalogSettings, clock: Clock):
        self.session = session
        self.platform = PlatformRepository(session)
        self.booking = booking
        self.catalog = catalog
        self.clock = clock

    def policies(self) -> list[dict[str, Any]]:
        return policies(self.booking)

    async def cities(self) -> list[dict[str, Any]]:
        counts = await self.platform.city_counts(self.clock.now() - timedelta(days=CITY_WINDOW_DAYS))
        return [
            {"name": city, "artists": counts.get(city, (0, 0))[0], "bookings_30d": counts.get(city, (0, 0))[1]}
            for city in self.catalog.cities
        ]

    async def team(self, me: User) -> list[dict[str, Any]]:
        return [
            {
                "id": u.id,
                "name": member_name(u),
                "phone": u.phone,
                "email": u.email,
                "admin_since": granted_at,
                "is_me": u.id == me.id,
            }
            for u, granted_at in await self.platform.admins()
        ]

    async def add_admin(self, me: User, phone: str) -> dict[str, Any]:
        user = await self.platform.by_phone(phone)
        if user is None:
            raise NotFoundError("No account with that phone number. They need to sign in once first.")
        if UserRole.admin in user.roles:
            raise ConflictError("Already an admin")
        user.grant(UserRole.admin)
        await self.session.flush()
        return next(m for m in await self.team(me) if m["id"] == user.id)

    async def remove_admin(self, me: User, user_id: uuid.UUID) -> None:
        if user_id == me.id:
            raise ConflictError("You can't remove your own admin access")
        grant = await self.platform.admin_grant(user_id)
        if grant is None:
            raise NotFoundError("Not an admin")
        if await self.platform.admin_count() <= 1:
            raise ConflictError("The console needs at least one admin")
        await self.platform.delete(grant)
        await self.session.flush()
