"""Queries behind the public directory: approved artists, their categories, completed-booking counts."""

import uuid
from collections.abc import Iterable

from sqlalchemy import Row, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import raiseload

from app.artist.models import ArtistProfile, ArtistServiceItem, artist_categories
from app.booking.models import Booking
from app.catalog.models import Category, ServiceTemplate
from app.shared.enums import ArtistServiceStatus, ArtistStatus, BookingStatus
from app.shared.pagination import keyset
from app.shared.search import like_pattern

# Approval time; created_at stands in if an approved row somehow lacks it, so paging never meets a NULL.
LISTED_AT = func.coalesce(ArtistProfile.reviewed_at, ArtistProfile.created_at)


class DirectoryRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def approved_page(
        self, city: str | None, category_id: int | None, q: str | None, limit: int, cursor: str | None
    ) -> list[Row]:
        """(profile, listed-at) rows, most recently approved first; `limit + 1` so the caller can tell if there's more.
        The public cards never need KYC, so it is never loaded."""
        query = (
            select(ArtistProfile, LISTED_AT)
            .where(ArtistProfile.status == ArtistStatus.approved)
            .options(raiseload(ArtistProfile.kyc))
        )
        if city:
            query = query.where(ArtistProfile.city == city)
        if category_id is not None:
            query = query.where(
                ArtistProfile.id.in_(
                    select(artist_categories.c.artist_id).where(artist_categories.c.category_id == category_id)
                )
            )
        if q and q.strip():
            pattern = like_pattern(q)
            offers_it = (
                select(ArtistServiceItem.artist_id)
                .outerjoin(ServiceTemplate, ServiceTemplate.id == ArtistServiceItem.template_id)
                .where(
                    ArtistServiceItem.status == ArtistServiceStatus.approved,
                    or_(
                        ArtistServiceItem.name.ilike(pattern, escape="\\"),
                        ServiceTemplate.name.ilike(pattern, escape="\\"),
                    ),
                )
            )
            query = query.where(
                or_(ArtistProfile.business_name.ilike(pattern, escape="\\"), ArtistProfile.id.in_(offers_it))
            )
        query = keyset(query, LISTED_AT, ArtistProfile.id, descending=True, cursor=cursor).limit(limit + 1)
        return list((await self.session.execute(query)).all())

    async def approved(self, artist_id: uuid.UUID) -> ArtistProfile | None:
        return (
            await self.session.execute(
                select(ArtistProfile)
                .where(ArtistProfile.id == artist_id, ArtistProfile.status == ArtistStatus.approved)
                .options(raiseload(ArtistProfile.kyc))
            )
        ).scalar_one_or_none()

    async def approved_many(self, artist_ids: list[uuid.UUID]) -> list[ArtistProfile]:
        query = (
            select(ArtistProfile)
            .where(ArtistProfile.id.in_(artist_ids), ArtistProfile.status == ArtistStatus.approved)
            .options(raiseload(ArtistProfile.kyc))
        )
        return list((await self.session.scalars(query)).all())

    async def categories(self, ids: Iterable[int]) -> dict[int, Category]:
        rows = (await self.session.execute(select(Category).where(Category.id.in_(set(ids))))).scalars()
        return {c.id: c for c in rows}

    async def completed_bookings(self, artist_id: uuid.UUID) -> int:
        return (
            await self.session.execute(
                select(func.count())
                .select_from(Booking)
                .where(Booking.artist_id == artist_id, Booking.status == BookingStatus.completed)
            )
        ).scalar_one()

    async def completed_by_service(self, artist_id: uuid.UUID) -> dict[uuid.UUID, int]:
        """service id → completed bookings; services nobody has finished a booking for are absent."""
        rows = await self.session.execute(
            select(Booking.service_id, func.count())
            .where(
                Booking.artist_id == artist_id,
                Booking.status == BookingStatus.completed,
                Booking.service_id.is_not(None),
            )
            .group_by(Booking.service_id)
        )
        return {service_id: count for service_id, count in rows.all()}
