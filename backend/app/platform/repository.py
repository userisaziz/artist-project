"""Queries for admin settings: per-city artist and booking counts, the admin team."""

import uuid
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.artist.models import ArtistProfile
from app.booking.models import Booking
from app.shared.enums import ArtistStatus, UserRole
from app.user.models import User, UserRoleGrant


class PlatformRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def city_counts(self, since: datetime) -> dict[str, tuple[int, int]]:
        """city -> (approved artists, bookings requested since `since`)."""
        artists = await self.session.execute(
            select(ArtistProfile.city, func.count())
            .where(ArtistProfile.status == ArtistStatus.approved)
            .group_by(ArtistProfile.city)
        )
        bookings = await self.session.execute(
            select(ArtistProfile.city, func.count())
            .select_from(Booking)
            .join(ArtistProfile, ArtistProfile.id == Booking.artist_id)
            .where(Booking.created_at >= since)
            .group_by(ArtistProfile.city)
        )
        a, b = dict(artists.all()), dict(bookings.all())
        return {city: (a.get(city, 0), b.get(city, 0)) for city in a.keys() | b.keys()}

    async def admins(self) -> list[tuple[User, datetime]]:
        rows = await self.session.execute(
            select(User, UserRoleGrant.granted_at)
            .join(UserRoleGrant, UserRoleGrant.user_id == User.id)
            .where(UserRoleGrant.role == UserRole.admin)
            .order_by(UserRoleGrant.granted_at, User.id)
        )
        return list(rows.tuples().all())

    async def by_phone(self, phone: str) -> User | None:
        return await self.session.scalar(select(User).where(User.phone == phone))

    async def admin_grant(self, user_id: uuid.UUID) -> UserRoleGrant | None:
        return await self.session.scalar(
            select(UserRoleGrant)
            .where(UserRoleGrant.user_id == user_id, UserRoleGrant.role == UserRole.admin)
            .with_for_update()
        )

    async def admin_count(self) -> int:
        return (
            await self.session.execute(select(func.count()).where(UserRoleGrant.role == UserRole.admin))
        ).scalar_one()

    async def delete(self, grant: UserRoleGrant) -> None:
        await self.session.delete(grant)
