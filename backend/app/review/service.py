"""Reviews: customers rate completed bookings, the auto-filter hides doubtful ones, artists reply or report,
admins moderate. Ratings are computed from public reviews on read (no stored counters)."""

import uuid
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy import ColumnElement, and_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.booking.service import approved_artist_id
from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.review.filters import review_flag, review_window_open
from app.review.models import PUBLIC_REVIEW, Review
from app.review.repository import ReviewRepository, ReviewRow
from app.review.schemas import ReviewIn, ReviewSummary
from app.shared.clock import Clock
from app.shared.enums import BookingStatus, ReviewStatus
from app.shared.pagination import split_page
from app.user.models import User

DECISIONS = {"publish": ReviewStatus.published, "hide": ReviewStatus.hidden, "remove": ReviewStatus.removed}


def one_decimal(value: Decimal | float) -> float:
    """Averages to one decimal, half up (4.25 → 4.3), the way people read ratings."""
    return float(Decimal(str(value)).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP))


def reviewer_name(first: str | None, last: str | None) -> str:
    if not first:
        return "Atelier customer"
    return f"{first} {last[0]}." if last else first


def public_fields(row: ReviewRow) -> dict:
    """The public shape of a review, as a plain dict; routes' response_models finish the job."""
    r = row.review
    return {
        "id": r.id,
        "rating": r.rating,
        "text": r.text,
        "reviewer_name": reviewer_name(row.first_name, row.last_name),
        "service_name": row.service_name,
        "created_at": r.created_at,
        "reply": r.reply,
        "replied_at": r.replied_at,
    }


def own_out(row: ReviewRow) -> dict:
    r = row.review
    return {**public_fields(row), "status": r.status, "flag": r.flag, "report_reason": r.report_reason}


def admin_out(row: ReviewRow) -> dict:
    r = row.review
    full_name = " ".join(n for n in (row.first_name, row.last_name) if n) or None
    return {
        **own_out(row),
        "moderator_note": r.moderator_note,
        "moderated_at": r.moderated_at,
        "artist": {"id": r.artist_id, "business_name": row.business_name},
        "customer": {"id": r.customer_id, "name": full_name, "phone": row.phone},
        "booking": {"id": r.booking_id, "code": row.code, "service_name": row.service_name},
    }


async def ratings_for(session: AsyncSession, artist_ids: list[uuid.UUID]) -> dict[uuid.UUID, tuple[float, int]]:
    """artist id → (average to one decimal, count) over public reviews; artists without reviews are absent."""
    if not artist_ids:
        return {}
    return {
        artist_id: (one_decimal(avg), count)
        for artist_id, avg, count in await ReviewRepository(session).averages(artist_ids)
    }


class ReviewService:
    def __init__(self, session: AsyncSession, clock: Clock):
        self.session = session
        self.reviews = ReviewRepository(session)
        self.clock = clock

    # --- shared ---------------------------------------------------------------------------------

    async def _page(
        self, where: list[ColumnElement[bool]], limit: int, cursor: str | None
    ) -> tuple[list[ReviewRow], str | None]:
        rows = await self.reviews.page_rows(where, limit=limit, cursor=cursor)
        return split_page(rows, limit, lambda r: (r.review.created_at, r.review.id))

    async def _row(self, review_id: uuid.UUID, *scope: ColumnElement[bool]) -> ReviewRow:
        row = await self.reviews.row(review_id, *scope)
        if row is None:
            raise NotFoundError("Review not found")
        return row

    async def _locked(self, review_id: uuid.UUID, *scope: ColumnElement[bool]) -> Review:
        review = await self.reviews.locked(review_id, *scope)
        if review is None:
            raise NotFoundError("Review not found")
        return review

    async def summary(self, artist_id: uuid.UUID) -> ReviewSummary:
        counts = await self.reviews.rating_counts(artist_id)
        total = sum(counts.values())
        average = one_decimal(Decimal(sum(r * n for r, n in counts.items())) / total) if total else None
        return ReviewSummary(
            average=average, count=total, distribution={str(r): counts.get(r, 0) for r in (5, 4, 3, 2, 1)}
        )

    # --- customer -------------------------------------------------------------------------------

    async def create(self, customer: User, booking_id: uuid.UUID, data: ReviewIn) -> dict:
        booking = await self.reviews.lock_customer_booking(booking_id, customer.id)
        if booking is None:
            raise NotFoundError("Booking not found")
        if booking.status != BookingStatus.completed:
            raise ConflictError("You can review a booking once it's completed")
        if not review_window_open(booking.completed_at, self.clock.now()):
            raise ConflictError("Reviews open for 30 days after the booking")
        if await self.reviews.exists_for_booking(booking.id):
            raise ConflictError("You've already reviewed this booking")

        flag = review_flag(data.text)
        review = Review(
            booking_id=booking.id,
            artist_id=booking.artist_id,
            customer_id=customer.id,
            rating=data.rating,
            text=data.text,
            status=ReviewStatus.hidden if flag else ReviewStatus.published,
            flag=flag,
        )
        self.reviews.add(review)
        try:
            await self.session.commit()
        except IntegrityError as exc:  # two posts for one booking at once: the unique booking_id decides
            await self.session.rollback()
            raise ConflictError("You've already reviewed this booking") from exc
        return own_out(await self._row(review.id))

    # --- public ---------------------------------------------------------------------------------

    async def public_list(self, artist_id: uuid.UUID, limit: int, cursor: str | None):
        """`artist_id` is an approved artist (checked by the route's `valid_artist_id`)."""
        where = [Review.artist_id == artist_id, Review.status.in_(PUBLIC_REVIEW)]
        rows, next_cursor = await self._page(where, limit, cursor)
        return [public_fields(r) for r in rows], next_cursor, await self.summary(artist_id)

    # --- artist ---------------------------------------------------------------------------------

    async def artist_list(self, user: User, limit: int, cursor: str | None):
        artist_id = await approved_artist_id(self.session, user)
        where = [Review.artist_id == artist_id, Review.status != ReviewStatus.removed]
        rows, next_cursor = await self._page(where, limit, cursor)
        return [own_out(r) for r in rows], next_cursor, await self.summary(artist_id)

    async def _artist_review(self, user: User, review_id: uuid.UUID) -> tuple[Review, ColumnElement[bool]]:
        theirs = and_(
            Review.artist_id == await approved_artist_id(self.session, user), Review.status != ReviewStatus.removed
        )
        return await self._locked(review_id, theirs), theirs

    async def reply(self, user: User, review_id: uuid.UUID, text: str) -> dict:
        if review_flag(text):
            raise ValidationError("Replies can't include phone numbers, emails, links or blocked words")
        review, theirs = await self._artist_review(user, review_id)
        review.reply = text.strip() or None
        review.replied_at = self.clock.now() if review.reply else None
        await self.session.commit()
        return own_out(await self._row(review_id, theirs))

    async def report(self, user: User, review_id: uuid.UUID, reason: str) -> dict:
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
        rows, next_cursor = await self._page([Review.status == status] if status else [], limit, cursor)
        return [admin_out(r) for r in rows], next_cursor

    async def decide(self, admin: User, review_id: uuid.UUID, decision: str, note: str | None) -> dict:
        # Locked lookup in the service, not a valid_review_id dependency: the row lock belongs to this transaction.
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
        review.moderated_at = self.clock.now()
        await self.session.commit()
        return admin_out(await self._row(review_id))

    async def needs_moderation_count(self) -> int:
        return await self.reviews.needs_moderation_count()
