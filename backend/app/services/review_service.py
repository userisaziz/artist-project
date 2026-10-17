"""Reviews: customers rate completed bookings, the auto-filter hides doubtful ones, artists reply or report,
admins moderate. Ratings are computed from public reviews on read (no stored counters)."""

import uuid
from decimal import ROUND_HALF_UP, Decimal
from typing import NamedTuple

from fastapi import Depends
from sqlalchemy import ColumnElement, Select, and_, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.models.artist.artist import ArtistProfile
from app.models.booking import Booking
from app.models.review import PUBLIC_REVIEW, Review
from app.schemas.review import (
    AdminReviewOut,
    OwnReviewOut,
    RefOut,
    ReviewBooking,
    ReviewCustomer,
    ReviewIn,
    ReviewOut,
    ReviewSummary,
)
from app.services.booking_service import approved_artist_id
from app.shared import clock
from app.shared.cursor import decode_cursor, encode_cursor
from app.shared.enums import ArtistStatus, BookingStatus, ReviewStatus
from app.user.models import User
from app.utils.review_filter import review_flag, review_window_open

DECISIONS = {"publish": ReviewStatus.published, "hide": ReviewStatus.hidden, "remove": ReviewStatus.removed}


def one_decimal(value: Decimal | float) -> float:
    """Averages to one decimal, half up (4.25 → 4.3), the way people read ratings."""
    return float(Decimal(str(value)).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP))


def reviewer_name(first: str | None, last: str | None) -> str:
    if not first:
        return "Atelier customer"
    return f"{first} {last[0]}." if last else first


class ReviewRow(NamedTuple):
    review: Review
    service_name: str
    code: str
    first_name: str | None
    last_name: str | None
    phone: str
    business_name: str


def rows_query() -> Select:
    return (
        select(Review, Booking.service_name, Booking.code, User.first_name, User.last_name, User.phone,
               ArtistProfile.business_name)
        .join(Booking, Booking.id == Review.booking_id)
        .join(User, User.id == Review.customer_id)
        .join(ArtistProfile, ArtistProfile.id == Review.artist_id)
    )


def public_out(row: ReviewRow) -> ReviewOut:
    r = row.review
    return ReviewOut(
        id=r.id, rating=r.rating, text=r.text, reviewer_name=reviewer_name(row.first_name, row.last_name),
        service_name=row.service_name, created_at=r.created_at, reply=r.reply, replied_at=r.replied_at,
    )


def own_out(row: ReviewRow) -> OwnReviewOut:
    r = row.review
    return OwnReviewOut(**public_out(row).model_dump(), status=r.status, flag=r.flag, report_reason=r.report_reason)


def admin_out(row: ReviewRow) -> AdminReviewOut:
    r = row.review
    full_name = " ".join(n for n in (row.first_name, row.last_name) if n) or None
    return AdminReviewOut(
        **own_out(row).model_dump(), moderator_note=r.moderator_note, moderated_at=r.moderated_at,
        artist=RefOut(id=r.artist_id, business_name=row.business_name),
        customer=ReviewCustomer(id=r.customer_id, name=full_name, phone=row.phone),
        booking=ReviewBooking(id=r.booking_id, code=row.code, service_name=row.service_name),
    )


async def ratings_for(session: AsyncSession, artist_ids: list[uuid.UUID]) -> dict[uuid.UUID, tuple[float, int]]:
    """artist id → (average to one decimal, count) over public reviews; artists without reviews are absent."""
    if not artist_ids:
        return {}
    rows = await session.execute(
        select(Review.artist_id, func.avg(Review.rating), func.count())
        .where(Review.artist_id.in_(artist_ids), Review.status.in_(PUBLIC_REVIEW))
        .group_by(Review.artist_id)
    )
    return {artist_id: (one_decimal(avg), count) for artist_id, avg, count in rows.all()}


def needs_moderation() -> ColumnElement[bool]:
    """Flagged reviews, and auto-hidden ones no moderator has looked at yet."""
    return or_(
        Review.status == ReviewStatus.flagged,
        and_(Review.status == ReviewStatus.hidden, Review.moderated_at.is_(None)),
    )


class ReviewService:
    def __init__(self, session: AsyncSession):
        self.session = session

    # --- shared ---------------------------------------------------------------------------------

    async def _page(self, query: Select, limit: int, cursor: str | None) -> tuple[list[ReviewRow], str | None]:
        """Newest first; keyset on (created_at, id)."""
        if cursor:
            at, row_id = decode_cursor(cursor)
            query = query.where(or_(Review.created_at < at, and_(Review.created_at == at, Review.id < row_id)))
        rows = [ReviewRow(*r) for r in (await self.session.execute(
            query.order_by(Review.created_at.desc(), Review.id.desc()).limit(limit + 1)
        )).all()]
        page = rows[:limit]
        last = page[-1].review if page else None
        return page, encode_cursor(last.created_at, last.id) if len(rows) > limit else None

    async def _row(self, review_id: uuid.UUID, *scope: ColumnElement[bool]) -> ReviewRow:
        row = (await self.session.execute(rows_query().where(Review.id == review_id, *scope))).one_or_none()
        if row is None:
            raise NotFoundError("Review not found")
        return ReviewRow(*row)

    async def _locked(self, review_id: uuid.UUID, *scope: ColumnElement[bool]) -> Review:
        review = (await self.session.execute(
            select(Review).where(Review.id == review_id, *scope).with_for_update()
            .execution_options(populate_existing=True)
        )).scalar_one_or_none()
        if review is None:
            raise NotFoundError("Review not found")
        return review

    async def summary(self, artist_id: uuid.UUID) -> ReviewSummary:
        counts = dict((await self.session.execute(
            select(Review.rating, func.count())
            .where(Review.artist_id == artist_id, Review.status.in_(PUBLIC_REVIEW))
            .group_by(Review.rating)
        )).all())
        total = sum(counts.values())
        average = one_decimal(Decimal(sum(r * n for r, n in counts.items())) / total) if total else None
        return ReviewSummary(average=average, count=total, distribution={str(r): counts.get(r, 0) for r in (5, 4, 3, 2, 1)})

    # --- customer -------------------------------------------------------------------------------

    async def create(self, customer: User, booking_id: uuid.UUID, data: ReviewIn) -> OwnReviewOut:
        booking = (await self.session.execute(
            select(Booking).where(Booking.id == booking_id, Booking.customer_id == customer.id).with_for_update()
        )).scalar_one_or_none()
        if booking is None:
            raise NotFoundError("Booking not found")
        if booking.status != BookingStatus.completed:
            raise ConflictError("You can review a booking once it's completed")
        if not review_window_open(booking.completed_at, clock.now()):
            raise ConflictError("Reviews open for 30 days after the booking")
        if await self.session.scalar(select(Review.id).where(Review.booking_id == booking.id)):
            raise ConflictError("You've already reviewed this booking")

        flag = review_flag(data.text)
        review = Review(
            booking_id=booking.id, artist_id=booking.artist_id, customer_id=customer.id, rating=data.rating,
            text=data.text, status=ReviewStatus.hidden if flag else ReviewStatus.published, flag=flag,
        )
        self.session.add(review)
        try:
            await self.session.commit()
        except IntegrityError as exc:  # two posts for one booking at once: the unique booking_id decides
            await self.session.rollback()
            raise ConflictError("You've already reviewed this booking") from exc
        return own_out(await self._row(review.id))

    # --- public ---------------------------------------------------------------------------------

    async def public_list(self, artist_id: uuid.UUID, limit: int, cursor: str | None):
        approved = await self.session.scalar(
            select(ArtistProfile.id).where(ArtistProfile.id == artist_id, ArtistProfile.status == ArtistStatus.approved)
        )
        if approved is None:
            raise NotFoundError("Artist not found")
        query = rows_query().where(Review.artist_id == artist_id, Review.status.in_(PUBLIC_REVIEW))
        rows, next_cursor = await self._page(query, limit, cursor)
        return [public_out(r) for r in rows], next_cursor, await self.summary(artist_id)

    # --- artist ---------------------------------------------------------------------------------

    async def artist_list(self, user: User, limit: int, cursor: str | None):
        artist_id = await approved_artist_id(self.session, user)
        query = rows_query().where(Review.artist_id == artist_id, Review.status != ReviewStatus.removed)
        rows, next_cursor = await self._page(query, limit, cursor)
        return [own_out(r) for r in rows], next_cursor, await self.summary(artist_id)

    async def _artist_review(self, user: User, review_id: uuid.UUID) -> tuple[Review, ColumnElement[bool]]:
        theirs = and_(Review.artist_id == await approved_artist_id(self.session, user), Review.status != ReviewStatus.removed)
        return await self._locked(review_id, theirs), theirs

    async def reply(self, user: User, review_id: uuid.UUID, text: str) -> OwnReviewOut:
        if review_flag(text):
            raise ValidationError("Replies can't include phone numbers, emails, links or blocked words")
        review, theirs = await self._artist_review(user, review_id)
        review.reply = text.strip() or None
        review.replied_at = clock.now() if review.reply else None
        await self.session.commit()
        return own_out(await self._row(review_id, theirs))

    async def report(self, user: User, review_id: uuid.UUID, reason: str) -> OwnReviewOut:
        review, theirs = await self._artist_review(user, review_id)
        if review.status != ReviewStatus.published:
            raise ConflictError("Only published reviews can be reported")
        review.status = ReviewStatus.flagged
        review.flag = "artist_report"
        review.report_reason = reason
        await self.session.commit()
        return own_out(await self._row(review_id, theirs))

    # --- admin ----------------------------------------------------------------------------------

    async def admin_list(self, status: ReviewStatus | None, limit: int, cursor: str | None):
        query = rows_query()
        if status:
            query = query.where(Review.status == status)
        rows, next_cursor = await self._page(query, limit, cursor)
        return [admin_out(r) for r in rows], next_cursor

    async def decide(self, admin: User, review_id: uuid.UUID, decision: str, note: str | None) -> AdminReviewOut:
        review = await self._locked(review_id)
        if review.status == ReviewStatus.removed:
            raise ConflictError("This review was removed")
        review.status = DECISIONS[decision]
        if review.status == ReviewStatus.published:
            review.flag = None
            review.report_reason = None
        if note is not None:  # omitted keeps the note; an empty one clears it
            review.moderator_note = note.strip() or None
        review.moderated_by = admin.id
        review.moderated_at = clock.now()
        await self.session.commit()
        return admin_out(await self._row(review_id))

    async def needs_moderation_count(self) -> int:
        return await self.session.scalar(select(func.count()).select_from(Review).where(needs_moderation()))


def get_review_service(session: AsyncSession = Depends(get_db)) -> ReviewService:
    return ReviewService(session)
