"""Queries over bookings (and the artist/customer rows they lock). Business rules stay in the services."""

import uuid
from collections.abc import Sequence
from datetime import date, datetime
from typing import NamedTuple

from sqlalchemy import ColumnElement, Date, Row, Select, and_, case, cast, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import InstrumentedAttribute

from app.artist.models import ArtistProfile, ArtistServiceItem
from app.booking.models import Booking
from app.review.models import Review
from app.shared.enums import ArtistServiceStatus, ArtistStatus, BookingStatus, ReviewStatus
from app.shared.pagination import keyset
from app.user.models import User


class BookingRow(NamedTuple):
    booking: Booking
    business_name: str
    photo_key: str | None
    city: str
    first_name: str | None
    last_name: str | None
    phone: str
    review_id: uuid.UUID | None
    review_rating: int | None
    review_status: ReviewStatus | None


def rows_query() -> Select:
    """A booking with what every view of it shows: the artist card, the customer's name, its review."""
    return (
        select(
            Booking,
            ArtistProfile.business_name,
            ArtistProfile.photo_key,
            ArtistProfile.city,
            User.first_name,
            User.last_name,
            User.phone,
            Review.id,
            Review.rating,
            Review.status,
        )
        .join(ArtistProfile, ArtistProfile.id == Booking.artist_id)
        .join(User, User.id == Booking.customer_id)
        .outerjoin(Review, Review.booking_id == Booking.id)  # at most one per booking
    )


def holds_slot(now: datetime) -> ColumnElement[bool]:
    """Bookings that occupy their time: confirmed, or requested and still inside the answer window."""
    return or_(
        Booking.status == BookingStatus.confirmed,
        and_(Booking.status == BookingStatus.requested, Booking.expires_at > now),
    )


class BookingRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    # --- reads ----------------------------------------------------------------------------------

    async def page_rows(
        self,
        where: Sequence[ColumnElement[bool]],
        column: InstrumentedAttribute,
        *,
        descending: bool,
        limit: int,
        cursor: str | None,
    ) -> list[BookingRow]:
        """`limit + 1` rows in keyset order on (column, id), so the caller can tell whether there is more."""
        query = keyset(rows_query().where(*where), column, Booking.id, descending=descending, cursor=cursor)
        return [BookingRow(*r) for r in (await self.session.execute(query.limit(limit + 1))).all()]

    async def row(self, booking_id: uuid.UUID, *scope: ColumnElement[bool]) -> BookingRow | None:
        row = (await self.session.execute(rows_query().where(Booking.id == booking_id, *scope))).one_or_none()
        return BookingRow(*row) if row else None

    async def rows_starting_between(
        self, start: datetime, end: datetime, *where: ColumnElement[bool]
    ) -> list[BookingRow]:
        query = rows_query().where(Booking.start_at >= start, Booking.start_at < end, *where).order_by(Booking.start_at)
        return [BookingRow(*r) for r in (await self.session.execute(query)).all()]

    async def busy_ranges(
        self, artist_id: uuid.UUID, start: datetime, end: datetime, now: datetime
    ) -> list[tuple[datetime, datetime]]:
        """The artist's slot-holding bookings that overlap [start, end)."""
        rows = await self.session.execute(
            select(Booking.start_at, Booking.end_at).where(
                Booking.artist_id == artist_id, Booking.start_at < end, Booking.end_at > start, holds_slot(now)
            )
        )
        return [(s, e) for s, e in rows.all()]

    async def artist_of(self, user_id: uuid.UUID) -> Row | None:
        """(id, status) of the user's artist profile."""
        return (
            await self.session.execute(
                select(ArtistProfile.id, ArtistProfile.status).where(ArtistProfile.user_id == user_id)
            )
        ).one_or_none()

    async def approved_service(self, service_id: uuid.UUID, artist_id: uuid.UUID) -> ArtistServiceItem | None:
        return (
            await self.session.execute(
                select(ArtistServiceItem).where(
                    ArtistServiceItem.id == service_id,
                    ArtistServiceItem.artist_id == artist_id,
                    ArtistServiceItem.status == ArtistServiceStatus.approved,
                )
            )
        ).scalar_one_or_none()

    async def open_request_count(self, customer_id: uuid.UUID, now: datetime) -> int:
        return (
            await self.session.execute(
                select(func.count())
                .select_from(Booking)
                .where(
                    Booking.customer_id == customer_id,
                    Booking.status == BookingStatus.requested,
                    Booking.expires_at > now,
                )
            )
        ).scalar_one()

    async def count(self, model, *where: ColumnElement[bool]) -> int:
        return (await self.session.execute(select(func.count()).select_from(model).where(*where))).scalar_one()

    async def artist_earnings(self, *where: ColumnElement[bool]) -> int:
        """What the artist keeps (service price minus commission) over matching bookings."""
        return (
            await self.session.execute(
                select(func.coalesce(func.sum(Booking.subtotal_paise - Booking.commission_paise), 0)).where(*where)
            )
        ).scalar_one()

    async def gross(self, *where: ColumnElement[bool]) -> int:
        """Total value of matching bookings, leaving out ones that were declined or left to expire."""
        return (
            await self.session.execute(
                select(func.coalesce(func.sum(Booking.total_paise), 0)).where(
                    *where, Booking.status.not_in((BookingStatus.declined, BookingStatus.expired))
                )
            )
        ).scalar_one()

    async def approved_artist_cities(self) -> list[str]:
        """Every city with at least one approved artist, A to Z."""
        rows = await self.session.execute(
            select(ArtistProfile.city)
            .where(ArtistProfile.status == ArtistStatus.approved)
            .distinct()
            .order_by(ArtistProfile.city)
        )
        return list(rows.scalars())

    async def weekly_counts(self, since: datetime, *where: ColumnElement[bool]) -> dict[date, int]:
        """Matching bookings created per IST week (Monday start) since `since`."""
        week_of = cast(func.date_trunc("week", func.timezone("Asia/Kolkata", Booking.created_at)), Date)
        rows = await self.session.execute(
            select(week_of, func.count()).where(Booking.created_at >= since, *where).group_by(week_of)
        )
        return dict(rows.all())

    # --- writes and locks -----------------------------------------------------------------------

    async def expire_overdue(self, now: datetime, *scope: ColumnElement[bool]) -> None:
        """Requests past their answer window become expired, with their deposit due back."""
        await self.session.execute(
            update(Booking)
            .where(Booking.status == BookingStatus.requested, Booking.expires_at <= now, *scope)
            .values(status=BookingStatus.expired, refund_due=case((Booking.deposit_paise > 0, True), else_=None))
            .execution_options(synchronize_session=False)
        )

    async def locked(self, booking_id: uuid.UUID, *scope: ColumnElement[bool]) -> Booking | None:
        """SELECT … FOR UPDATE, refreshed from the database."""
        return (
            await self.session.execute(
                select(Booking)
                .where(Booking.id == booking_id, *scope)
                .with_for_update()
                .execution_options(populate_existing=True)
            )
        ).scalar_one_or_none()

    async def lock_approved_artist(self, artist_id: uuid.UUID) -> Row | None:
        """(id, user_id) of an approved artist, row-locked: requests for one artist queue behind each other."""
        return (
            await self.session.execute(
                select(ArtistProfile.id, ArtistProfile.user_id)
                .where(ArtistProfile.id == artist_id, ArtistProfile.status == ArtistStatus.approved)
                .with_for_update()
            )
        ).one_or_none()

    async def lock_customer(self, customer_id: uuid.UUID) -> None:
        """Row-lock the customer: one customer's concurrent requests queue, so the open-request cap holds."""
        await self.session.execute(select(User.id).where(User.id == customer_id).with_for_update())

    def add(self, booking: Booking) -> None:
        self.session.add(booking)
