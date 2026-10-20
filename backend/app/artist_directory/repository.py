"""Queries for the admin artist directory: rows with first category and completed-booking figures, segment
counts and platform KPIs, all aggregated in SQL."""

import uuid
from collections.abc import Sequence
from datetime import datetime
from typing import NamedTuple

from sqlalchemy import ColumnElement, Select, and_, case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.artist.models import ArtistProfile, artist_categories
from app.artist_directory.models import ArtistSuspension
from app.booking.models import Booking
from app.catalog.models import Category
from app.review.models import PUBLIC_REVIEW, Review
from app.shared.enums import ArtistStatus, BookingStatus
from app.shared.pagination import keyset
from app.shared.search import like_pattern

LISTED = ArtistProfile.status != ArtistStatus.draft  # drafts aren't the admin's business yet
COMPLETED = and_(Booking.artist_id == ArtistProfile.id, Booking.status == BookingStatus.completed)


class DirectoryRecord(NamedTuple):
    profile: ArtistProfile
    category: str | None
    bookings_total: int
    booking_value: int


def first_category() -> ColumnElement:
    return (
        select(Category.name)
        .join(artist_categories, artist_categories.c.category_id == Category.id)
        .where(artist_categories.c.artist_id == ArtistProfile.id)
        .order_by(Category.sort_order, Category.id)
        .limit(1)
        .scalar_subquery()
    )


def rows_query(since: datetime) -> Select:
    bookings_total = select(func.count()).where(COMPLETED).scalar_subquery()
    value = (
        select(func.coalesce(func.sum(Booking.total_paise), 0))
        .where(COMPLETED, Booking.completed_at >= since)
        .scalar_subquery()
    )
    return select(ArtistProfile, first_category(), bookings_total, value).where(LISTED)


def matches(q: str) -> ColumnElement[bool]:
    return ArtistProfile.business_name.ilike(like_pattern(q), escape="\\")


class DirectoryRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def page(
        self, since: datetime, where: Sequence[ColumnElement[bool]], *, limit: int, cursor: str | None
    ) -> list[DirectoryRecord]:
        """Newest profiles first, keyset on (created_at, id), `limit + 1` rows."""
        query = keyset(
            rows_query(since).where(*where), ArtistProfile.created_at, ArtistProfile.id, descending=True, cursor=cursor
        )
        return [DirectoryRecord(*r) for r in (await self.session.execute(query.limit(limit + 1))).all()]

    async def counts(self, since: datetime) -> dict[str, int]:
        status = ArtistProfile.status
        row = (
            await self.session.execute(
                select(
                    func.count(),
                    func.count().filter(status == ArtistStatus.approved),
                    func.count().filter(status == ArtistStatus.pending),
                    func.count().filter(status == ArtistStatus.suspended),
                    func.count().filter(status == ArtistStatus.approved, ArtistProfile.reviewed_at >= since),
                ).where(LISTED)
            )
        ).one()
        return {"all": row[0], "approved": row[1], "pending": row[2], "suspended": row[3], "new": row[4]}

    async def rating(self) -> tuple[float | None, int]:
        """Average and count of public reviews of approved artists."""
        row = (
            await self.session.execute(
                select(func.avg(Review.rating), func.count())
                .join(ArtistProfile, ArtistProfile.id == Review.artist_id)
                .where(Review.status.in_(PUBLIC_REVIEW), ArtistProfile.status == ArtistStatus.approved)
            )
        ).one()
        return (float(row[0]) if row[0] is not None else None), row[1]

    async def median_response_minutes(self, since: datetime) -> float | None:
        minutes = func.extract("epoch", Booking.responded_at - Booking.created_at) / 60
        value = await self.session.scalar(
            select(func.percentile_cont(0.5).within_group(minutes)).where(
                Booking.created_at >= since, Booking.responded_at.is_not(None)
            )
        )
        return float(value) if value is not None else None

    async def at_risk(self, since: datetime, rate: float) -> int:
        """Approved artists whose declined or artist-cancelled share of the window's bookings is over `rate`."""
        let_down = or_(
            Booking.status == BookingStatus.declined,
            and_(Booking.status == BookingStatus.cancelled, Booking.cancelled_by == "artist"),
        )
        per_artist = (
            select(Booking.artist_id)
            .join(ArtistProfile, ArtistProfile.id == Booking.artist_id)
            .where(Booking.created_at >= since, ArtistProfile.status == ArtistStatus.approved)
            .group_by(Booking.artist_id)
            .having(func.sum(case((let_down, 1), else_=0)) > rate * func.count())
            .subquery()
        )
        return (await self.session.execute(select(func.count()).select_from(per_artist))).scalar_one()

    async def profile(self, artist_id: uuid.UUID) -> ArtistProfile | None:
        return await self.session.scalar(select(ArtistProfile).where(ArtistProfile.id == artist_id).with_for_update())

    async def suspension(self, artist_id: uuid.UUID) -> ArtistSuspension | None:
        return await self.session.get(ArtistSuspension, artist_id)

    def add(self, row: ArtistSuspension) -> None:
        self.session.add(row)

    async def delete(self, row: ArtistSuspension) -> None:
        await self.session.delete(row)
