"""Queries over reviews. Rating maths and moderation rules stay in the service."""

import uuid
from collections.abc import Sequence
from typing import NamedTuple

from sqlalchemy import ColumnElement, Select, and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.artist.models import ArtistProfile
from app.booking.models import Booking
from app.review.models import PUBLIC_REVIEW, Review
from app.shared.enums import ArtistStatus, ReviewStatus
from app.shared.pagination import keyset
from app.user.models import User


class ReviewRow(NamedTuple):
    review: Review
    service_name: str
    code: str
    first_name: str | None
    last_name: str | None
    phone: str
    business_name: str


def rows_query() -> Select:
    """A review with what every view of it shows: the booking, the reviewer, the artist."""
    return (
        select(
            Review,
            Booking.service_name,
            Booking.code,
            User.first_name,
            User.last_name,
            User.phone,
            ArtistProfile.business_name,
        )
        .join(Booking, Booking.id == Review.booking_id)
        .join(User, User.id == Review.customer_id)
        .join(ArtistProfile, ArtistProfile.id == Review.artist_id)
    )


def needs_moderation() -> ColumnElement[bool]:
    """Flagged reviews, and auto-hidden ones no moderator has looked at yet."""
    return or_(
        Review.status == ReviewStatus.flagged,
        and_(Review.status == ReviewStatus.hidden, Review.moderated_at.is_(None)),
    )


class ReviewRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def page_rows(
        self, where: Sequence[ColumnElement[bool]], *, limit: int, cursor: str | None
    ) -> list[ReviewRow]:
        """Newest first, keyset on (created_at, id); `limit + 1` rows so the caller can tell whether there is more."""
        query = keyset(rows_query().where(*where), Review.created_at, Review.id, descending=True, cursor=cursor)
        return [ReviewRow(*r) for r in (await self.session.execute(query.limit(limit + 1))).all()]

    async def row(self, review_id: uuid.UUID, *scope: ColumnElement[bool]) -> ReviewRow | None:
        row = (await self.session.execute(rows_query().where(Review.id == review_id, *scope))).one_or_none()
        return ReviewRow(*row) if row else None

    async def locked(self, review_id: uuid.UUID, *scope: ColumnElement[bool]) -> Review | None:
        """SELECT … FOR UPDATE, refreshed from the database."""
        return (
            await self.session.execute(
                select(Review)
                .where(Review.id == review_id, *scope)
                .with_for_update()
                .execution_options(populate_existing=True)
            )
        ).scalar_one_or_none()

    async def rating_counts(self, artist_id: uuid.UUID) -> dict[int, int]:
        """rating → number of public reviews with it."""
        rows = await self.session.execute(
            select(Review.rating, func.count())
            .where(Review.artist_id == artist_id, Review.status.in_(PUBLIC_REVIEW))
            .group_by(Review.rating)
        )
        return dict(rows.all())

    async def averages(self, artist_ids: list[uuid.UUID]) -> list[tuple[uuid.UUID, float, int]]:
        """(artist id, raw average, count) over public reviews, for artists that have any."""
        rows = await self.session.execute(
            select(Review.artist_id, func.avg(Review.rating), func.count())
            .where(Review.artist_id.in_(artist_ids), Review.status.in_(PUBLIC_REVIEW))
            .group_by(Review.artist_id)
        )
        return [tuple(r) for r in rows.all()]

    async def lock_customer_booking(self, booking_id: uuid.UUID, customer_id: uuid.UUID) -> Booking | None:
        return (
            await self.session.execute(
                select(Booking).where(Booking.id == booking_id, Booking.customer_id == customer_id).with_for_update()
            )
        ).scalar_one_or_none()

    async def exists_for_booking(self, booking_id: uuid.UUID) -> bool:
        return await self.session.scalar(select(Review.id).where(Review.booking_id == booking_id)) is not None

    async def is_approved_artist(self, artist_id: uuid.UUID) -> bool:
        found = await self.session.scalar(
            select(ArtistProfile.id).where(ArtistProfile.id == artist_id, ArtistProfile.status == ArtistStatus.approved)
        )
        return found is not None

    async def needs_moderation_count(self) -> int:
        return await self.session.scalar(select(func.count()).select_from(Review).where(needs_moderation()))

    def add(self, review: Review) -> None:
        self.session.add(review)
