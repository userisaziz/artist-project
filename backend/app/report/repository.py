"""Report queries. Every count, grouping and join happens in SQL; the service only formats rows as CSV."""

from collections.abc import Sequence
from datetime import datetime
from typing import Any

from sqlalchemy import ColumnElement, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.artist.models import ArtistProfile, ArtistServiceItem
from app.artist_directory.repository import first_category
from app.booking.models import Booking
from app.catalog.models import Category
from app.report.constants import EXPORT_MAX_ROWS, IST, UNKNOWN
from app.review.models import Review
from app.shared.enums import ArtistStatus, BookingStatus
from app.support.models import Ticket
from app.user.models import User

ParentCategory = aliased(Category, name="parent_category")
# Services belong to a subcategory (Mehendi › Bridal); reports group by the top-level category.
CATEGORY = func.coalesce(ParentCategory.name, Category.name, UNKNOWN)


def booked_since(since: datetime | None) -> list[ColumnElement[bool]]:
    return [Booking.created_at >= since] if since else []


class ReportRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def booking_counts(self, where: Sequence[ColumnElement[bool]]) -> tuple[int, int]:
        row = (
            await self.session.execute(
                select(func.count(), func.count().filter(Booking.status == BookingStatus.completed)).where(*where)
            )
        ).one()
        return row[0], row[1]

    async def top(self, column: ColumnElement, where: Sequence[ColumnElement[bool]], *, by_category: bool):
        """(name, bookings) of the busiest city or category in the period, or None with no bookings."""
        query = (
            select(column, func.count()).select_from(Booking).join(ArtistProfile, ArtistProfile.id == Booking.artist_id)
        )
        if by_category:
            query = (
                query.outerjoin(ArtistServiceItem, ArtistServiceItem.id == Booking.service_id)
                .outerjoin(Category, Category.id == ArtistServiceItem.category_id)
                .outerjoin(ParentCategory, ParentCategory.id == Category.parent_id)
            )
        row = (
            await self.session.execute(
                query.where(*where).group_by(column).order_by(func.count().desc(), column).limit(1)
            )
        ).first()
        return (row[0], row[1]) if row else None

    async def bookings(self, where: Sequence[ColumnElement[bool]]) -> list[Any]:
        return list(
            (
                await self.session.execute(
                    select(
                        Booking.code,
                        Booking.status,
                        Booking.service_name,
                        ArtistProfile.business_name,
                        ArtistProfile.city,
                        func.concat_ws(" ", User.first_name, User.last_name),
                        User.phone,
                        Booking.start_at,
                        Booking.created_at,
                        Booking.total_paise,
                    )
                    .join(ArtistProfile, ArtistProfile.id == Booking.artist_id)
                    .join(User, User.id == Booking.customer_id)
                    .where(*where)
                    .order_by(Booking.created_at.desc())
                    .limit(EXPORT_MAX_ROWS)
                )
            ).all()
        )

    async def bookings_grouped(self, key: str, where: Sequence[ColumnElement[bool]]) -> list[Any]:
        if key == "city":
            column = ArtistProfile.city
        elif key == "category":
            column = CATEGORY
        else:
            column = func.date(func.date_trunc("week", func.timezone(IST, Booking.created_at)))
        query = (
            select(
                column.label("key"),
                func.count(),
                func.count().filter(Booking.status == BookingStatus.completed),
                func.count().filter(Booking.status == BookingStatus.cancelled),
            )
            .select_from(Booking)
            .join(ArtistProfile, ArtistProfile.id == Booking.artist_id)
            .outerjoin(ArtistServiceItem, ArtistServiceItem.id == Booking.service_id)
            .outerjoin(Category, Category.id == ArtistServiceItem.category_id)
            .outerjoin(ParentCategory, ParentCategory.id == Category.parent_id)
            .where(*where)
            .group_by(column)
        )
        order = column if key == "week" else func.count().desc()
        return list((await self.session.execute(query.order_by(order, column))).all())

    async def artists(self, since: datetime | None) -> list[Any]:
        where = [ArtistProfile.status != ArtistStatus.draft]
        if since:
            where.append(ArtistProfile.created_at >= since)
        return list(
            (
                await self.session.execute(
                    select(
                        ArtistProfile.business_name,
                        ArtistProfile.status,
                        ArtistProfile.city,
                        first_category(),
                        ArtistProfile.created_at,
                        ArtistProfile.reviewed_at,
                    )
                    .where(*where)
                    .order_by(ArtistProfile.created_at.desc())
                    .limit(EXPORT_MAX_ROWS)
                )
            ).all()
        )

    async def reviews(self, since: datetime | None) -> list[Any]:
        query = (
            select(
                Booking.code, ArtistProfile.business_name, Review.rating, Review.status, Review.created_at, Review.text
            )
            .join(Booking, Booking.id == Review.booking_id)
            .join(ArtistProfile, ArtistProfile.id == Review.artist_id)
        )
        if since:
            query = query.where(Review.created_at >= since)
        return list((await self.session.execute(query.order_by(Review.created_at.desc()).limit(EXPORT_MAX_ROWS))).all())

    async def tickets(self, since: datetime | None) -> list[Ticket]:
        query = select(Ticket)
        if since:
            query = query.where(Ticket.created_at >= since)
        return list((await self.session.scalars(query.order_by(Ticket.created_at.desc()).limit(EXPORT_MAX_ROWS))).all())
