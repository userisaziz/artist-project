"""Queries over enquiries (with the artist card and customer name every view shows). Rules stay in the service."""

import uuid
from collections.abc import Sequence
from datetime import date, datetime
from typing import NamedTuple

from sqlalchemy import ColumnElement, Row, Select, and_, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.artist.models import ArtistProfile
from app.quote.constants import LIVE, EnquiryStatus
from app.quote.models import QuoteEnquiry
from app.shared.enums import ArtistStatus
from app.shared.pagination import keyset
from app.user.models import User


class EnquiryRow(NamedTuple):
    enquiry: QuoteEnquiry
    business_name: str
    photo_key: str | None
    city: str
    first_name: str | None
    last_name: str | None


def rows_query() -> Select:
    return (
        select(
            QuoteEnquiry,
            ArtistProfile.business_name,
            ArtistProfile.photo_key,
            ArtistProfile.city,
            User.first_name,
            User.last_name,
        )
        .join(ArtistProfile, ArtistProfile.id == QuoteEnquiry.artist_id)
        .join(User, User.id == QuoteEnquiry.customer_id)
    )


def lapsed(today: date) -> ColumnElement[bool]:
    """Live enquiries past their event date, or quoted past the quote's valid-until date (both IST dates)."""
    return and_(
        QuoteEnquiry.status.in_(LIVE),
        or_(
            QuoteEnquiry.event_date < today,
            and_(QuoteEnquiry.status == EnquiryStatus.quoted, QuoteEnquiry.quote_valid_until_date < today),
        ),
    )


class QuoteRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def page_rows(self, where: Sequence[ColumnElement[bool]], limit: int, cursor: str | None) -> list[EnquiryRow]:
        """Newest first, `limit + 1` rows so the caller can tell whether there is more."""
        query = keyset(
            rows_query().where(*where), QuoteEnquiry.created_at, QuoteEnquiry.id, descending=True, cursor=cursor
        )
        return [EnquiryRow(*r) for r in (await self.session.execute(query.limit(limit + 1))).all()]

    async def row(self, enquiry_id: uuid.UUID, *scope: ColumnElement[bool]) -> EnquiryRow | None:
        row = (await self.session.execute(rows_query().where(QuoteEnquiry.id == enquiry_id, *scope))).one_or_none()
        return EnquiryRow(*row) if row else None

    async def approved_artist(self, artist_id: uuid.UUID) -> Row | None:
        """(id, user_id) of an approved artist."""
        return (
            await self.session.execute(
                select(ArtistProfile.id, ArtistProfile.user_id).where(
                    ArtistProfile.id == artist_id, ArtistProfile.status == ArtistStatus.approved
                )
            )
        ).one_or_none()

    async def artist_of(self, enquiry_id: uuid.UUID, *scope: ColumnElement[bool]) -> uuid.UUID | None:
        return await self.session.scalar(select(QuoteEnquiry.artist_id).where(QuoteEnquiry.id == enquiry_id, *scope))

    async def count(self, *where: ColumnElement[bool]) -> int:
        return (await self.session.execute(select(func.count()).select_from(QuoteEnquiry).where(*where))).scalar_one()

    async def count_by_status(self, *where: ColumnElement[bool]) -> dict[EnquiryStatus, int]:
        rows = await self.session.execute(
            select(QuoteEnquiry.status, func.count()).where(*where).group_by(QuoteEnquiry.status)
        )
        return {status: n for status, n in rows.all()}

    # --- writes and locks -----------------------------------------------------------------------

    async def expire_lapsed(self, today: date, *scope: ColumnElement[bool]) -> None:
        await self.session.execute(
            update(QuoteEnquiry)
            .where(lapsed(today), *scope)
            .values(status=EnquiryStatus.expired)
            .execution_options(synchronize_session=False)
        )

    async def locked(self, enquiry_id: uuid.UUID, *scope: ColumnElement[bool]) -> QuoteEnquiry | None:
        """SELECT … FOR UPDATE, refreshed from the database."""
        return (
            await self.session.execute(
                select(QuoteEnquiry)
                .where(QuoteEnquiry.id == enquiry_id, *scope)
                .with_for_update()
                .execution_options(populate_existing=True)
            )
        ).scalar_one_or_none()

    async def lock_customer(self, customer_id: uuid.UUID) -> None:
        """One customer's concurrent enquiries queue here, so the cap and the one-per-artist rule hold."""
        await self.session.execute(select(User.id).where(User.id == customer_id).with_for_update())

    async def cancel_live(self, at: datetime, *scope: ColumnElement[bool]) -> None:
        await self.session.execute(
            update(QuoteEnquiry)
            .where(QuoteEnquiry.status.in_(LIVE), *scope)
            .values(status=EnquiryStatus.cancelled, closed_at=at)
            .execution_options(synchronize_session=False)
        )

    def add(self, enquiry: QuoteEnquiry) -> None:
        self.session.add(enquiry)
