"""Queries over customers (accounts holding the customer role) for the admin console. Booking counts,
latest-booking city and segment counts are computed in SQL."""

import uuid
from collections.abc import Sequence
from datetime import datetime
from typing import NamedTuple

from sqlalchemy import ColumnElement, Select, and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.artist.models import ArtistProfile
from app.booking.models import Booking
from app.review.models import Review
from app.shared.enums import UserRole
from app.shared.pagination import keyset
from app.shared.search import like_pattern
from app.user.models import User, UserRoleGrant

IS_CUSTOMER = User.id.in_(select(UserRoleGrant.user_id).where(UserRoleGrant.role == UserRole.customer))
BOOKINGS = select(func.count()).where(Booking.customer_id == User.id).scalar_subquery()
LAST_BOOKING_AT = select(func.max(Booking.created_at)).where(Booking.customer_id == User.id).scalar_subquery()
CITY = (
    select(ArtistProfile.city)
    .join(Booking, Booking.artist_id == ArtistProfile.id)
    .where(Booking.customer_id == User.id)
    .order_by(Booking.created_at.desc())
    .limit(1)
    .scalar_subquery()
)


class CustomerRecord(NamedTuple):
    user: User
    bookings: int
    last_booking_at: datetime | None
    city: str | None


class RecentBookingRow(NamedTuple):
    booking: Booking
    artist_name: str


def rows_query() -> Select:
    return select(User, BOOKINGS, LAST_BOOKING_AT, CITY).where(IS_CUSTOMER)


def matches(q: str) -> ColumnElement[bool]:
    pattern = like_pattern(q)
    return or_(
        func.concat_ws(" ", User.first_name, User.last_name).ilike(pattern, escape="\\"),
        User.phone.ilike(pattern, escape="\\"),
        User.email.ilike(pattern, escape="\\"),
    )


def joined_since(since: datetime) -> ColumnElement[bool]:
    return User.created_at >= since


REPEAT = BOOKINGS >= 2
BLOCKED = User.is_active.is_(False)


class CustomerRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def page(
        self, where: Sequence[ColumnElement[bool]], *, limit: int, cursor: str | None
    ) -> list[CustomerRecord]:
        """Newest accounts first, keyset on (created_at, id), `limit + 1` rows."""
        query = keyset(rows_query().where(*where), User.created_at, User.id, descending=True, cursor=cursor)
        return [CustomerRecord(*r) for r in (await self.session.execute(query.limit(limit + 1))).all()]

    async def all_matching(self, where: Sequence[ColumnElement[bool]], cap: int) -> list[CustomerRecord]:
        query = rows_query().where(*where).order_by(User.created_at.desc(), User.id.desc()).limit(cap)
        return [CustomerRecord(*r) for r in (await self.session.execute(query)).all()]

    async def record(self, customer_id: uuid.UUID) -> CustomerRecord | None:
        row = (await self.session.execute(rows_query().where(User.id == customer_id))).one_or_none()
        return CustomerRecord(*row) if row else None

    async def customer(self, customer_id: uuid.UUID) -> User | None:
        return await self.session.scalar(select(User).where(User.id == customer_id, IS_CUSTOMER))

    async def segment_counts(self, new_since: datetime) -> dict[str, int]:
        """One pass over customers: all, joined since `new_since`, with 2+ bookings, blocked."""
        per = select(User.created_at, User.is_active, BOOKINGS.label("bookings")).where(IS_CUSTOMER).subquery()
        row = (
            await self.session.execute(
                select(
                    func.count(),
                    func.count().filter(per.c.created_at >= new_since),
                    func.count().filter(per.c.bookings >= 2),
                    func.count().filter(per.c.is_active.is_(False)),
                    func.count().filter(per.c.bookings >= 1),
                ).select_from(per)
            )
        ).one()
        return {"all": row[0], "new": row[1], "repeat": row[2], "blocked": row[3], "booked": row[4]}

    async def active_since(self, since: datetime) -> int:
        """Customers who requested at least one booking since `since`."""
        return await self.session.scalar(
            select(func.count(func.distinct(Booking.customer_id))).where(
                and_(Booking.created_at >= since, Booking.customer_id.in_(select(User.id).where(IS_CUSTOMER)))
            )
        )

    async def review_count(self, customer_id: uuid.UUID) -> int:
        return await self.session.scalar(select(func.count()).where(Review.customer_id == customer_id))

    async def recent_bookings(self, customer_id: uuid.UUID, limit: int) -> list[RecentBookingRow]:
        rows = await self.session.execute(
            select(Booking, ArtistProfile.business_name)
            .join(ArtistProfile, ArtistProfile.id == Booking.artist_id)
            .where(Booking.customer_id == customer_id)
            .order_by(Booking.created_at.desc())
            .limit(limit)
        )
        return [RecentBookingRow(*r) for r in rows.all()]
