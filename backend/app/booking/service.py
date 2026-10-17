"""Bookings for customers and artists: request a slot, accept, decline, complete, cancel.

Unanswered requests expire lazily: each read or write first marks overdue requests `expired`.
Writes commit before returning, because `get_db` commits only after the response is sent and a
customer must never see "requested" for a booking that wasn't saved.
"""

import secrets
import uuid
from datetime import date, datetime, time, timedelta
from typing import Any, Literal

from sqlalchemy import ColumnElement, and_, not_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import InstrumentedAttribute

from app.booking import rules
from app.booking.config import BookingSettings
from app.booking.models import Booking
from app.booking.repository import BookingRepository, BookingRow
from app.booking.schemas import BookingIn
from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.review.filters import review_window_open
from app.review.models import PUBLIC_REVIEW
from app.shared.clock import Clock
from app.shared.enums import ArtistStatus, BookingStatus
from app.shared.pagination import split_page
from app.upload.service import ImageStorage
from app.user.models import User

CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no 0/O or 1/I
OPEN = (BookingStatus.requested, BookingStatus.confirmed)
View = Literal["customer", "artist", "admin"]  # who a booking is shown to
CustomerScope = Literal["upcoming", "past"]
ArtistScope = Literal["requests", "upcoming", "past"]


def new_code() -> str:
    return "BK-" + "".join(secrets.choice(CODE_ALPHABET) for _ in range(6))


async def approved_artist_id(session: AsyncSession, user: User) -> uuid.UUID:
    """The caller's artist profile id; bookings and reviews open only once it's approved."""
    artist = await BookingRepository(session).artist_of(user.id)
    if artist is None:
        raise NotFoundError("No artist profile yet")
    if artist.status != ArtistStatus.approved:
        raise ConflictError("Bookings open once your profile is approved")
    return artist.id


def booking_out(row: BookingRow, storage: ImageStorage, view: View, now: datetime) -> dict[str, Any]:
    """Customers never see the platform's margin or the artist's payout; only admins see the customer's phone.
    Shape is a plain dict; the route's response_model validates and serialises it."""
    b = row.booking
    admin = view == "admin"
    margin_hidden = view == "customer"
    # The artist sees a review only once it's public; the reviewer and admins see it in any state.
    show_review = row.review_id is not None and (view != "artist" or row.review_status in PUBLIC_REVIEW)
    customer = {
        "id": b.customer_id,
        "first_name": row.first_name,
        "last_name": row.last_name,
        **({"phone": row.phone} if admin else {}),
    }
    return {
        "id": b.id,
        "code": b.code,
        "status": b.status,
        "start_at": b.start_at,
        "end_at": b.end_at,
        "address": b.address,
        "note": b.note,
        "service_name": b.service_name,
        "duration_minutes": b.duration_minutes,
        "artist": {
            "id": b.artist_id,
            "business_name": row.business_name,
            "city": row.city,
            "photo_url": storage.url(row.photo_key, "thumb") if row.photo_key else None,
        },
        "customer": customer,
        "subtotal_paise": b.subtotal_paise,
        "platform_fee_paise": b.platform_fee_paise,
        "total_paise": b.total_paise,
        "deposit_paise": b.deposit_paise,
        "balance_paise": b.balance_paise,
        "commission_paise": None if margin_hidden else b.commission_paise,
        "artist_earning_paise": None if margin_hidden else b.artist_earning_paise,
        "deposit_paid_at": b.deposit_paid_at,
        "expires_at": b.expires_at,
        "responded_at": b.responded_at,
        "cancelled_at": b.cancelled_at,
        "completed_at": b.completed_at,
        "decline_reason": b.decline_reason,
        "cancel_reason": b.cancel_reason,
        "cancelled_by": b.cancelled_by,
        "refund_due": b.refund_due,
        "created_at": b.created_at,
        "review": {"id": row.review_id, "rating": row.review_rating, "status": row.review_status}
        if show_review
        else None,
        "can_review": b.status == BookingStatus.completed
        and row.review_id is None
        and review_window_open(b.completed_at, now),
    }


def clean_reason(reason: str | None) -> str | None:
    return (reason or "").strip() or None


def ist_month_start(now: datetime) -> datetime:
    local = now.astimezone(rules.IST)
    return datetime.combine(date(local.year, local.month, 1), time(), tzinfo=rules.IST)


class BookingService:
    def __init__(self, session: AsyncSession, storage: ImageStorage, settings: BookingSettings, clock: Clock):
        self.session = session
        self.bookings = BookingRepository(session)
        self.storage = storage
        self.settings = settings
        self.clock = clock

    # --- shared ---------------------------------------------------------------------------------

    def out(self, row: BookingRow, view: View) -> dict[str, Any]:
        return booking_out(row, self.storage, view, self.clock.now())

    async def expire_overdue(self, *scope: ColumnElement[bool]) -> None:
        """Mark requests past their answer window as expired (their deposit is due back).
        Committed at once, so reads don't hold these row locks until after the response."""
        await self.bookings.expire_overdue(self.clock.now(), *scope)
        await self.session.commit()

    async def page(
        self,
        where: list[ColumnElement[bool]],
        column: InstrumentedAttribute,
        descending: bool,
        limit: int,
        cursor: str | None,
        view: View,
    ) -> tuple[list[dict[str, Any]], str | None]:
        rows = await self.bookings.page_rows(where, column, descending=descending, limit=limit, cursor=cursor)
        page, next_cursor = split_page(rows, limit, lambda r: (getattr(r.booking, column.key), r.booking.id))
        return [self.out(r, view) for r in page], next_cursor

    async def one(self, booking_id: uuid.UUID, *scope: ColumnElement[bool], view: View) -> dict[str, Any]:
        row = await self.bookings.row(booking_id, *scope)
        if row is None:
            raise NotFoundError("Booking not found")
        return self.out(row, view)

    async def locked(self, booking_id: uuid.UUID, *scope: ColumnElement[bool]) -> Booking:
        """The booking, row-locked so two people can't change it at once (e.g. accept vs cancel).

        Not a `valid_booking_id` dependency on purpose: the lock must be taken in this transaction, and the
        owner `scope` makes someone else's booking indistinguishable from a missing one (404, never 403)."""
        await self.expire_overdue(Booking.id == booking_id)
        booking = await self.bookings.locked(booking_id, *scope)
        if booking is None:
            raise NotFoundError("Booking not found")
        return booking

    @staticmethod
    def require(booking: Booking, *allowed: BookingStatus) -> None:
        if booking.status not in allowed:
            raise ConflictError(f"This booking is already {booking.status.value}")

    async def save(self, booking_id: uuid.UUID, *scope: ColumnElement[bool], view: View) -> dict[str, Any]:
        await self.session.commit()
        return await self.one(booking_id, *scope, view=view)

    # --- customer -------------------------------------------------------------------------------

    async def create(self, customer: User, data: BookingIn) -> dict[str, Any]:
        now = self.clock.now()
        # Lock the artist row: concurrent requests for the same artist queue here, so the overlap check is reliable.
        artist = await self.bookings.lock_approved_artist(data.artist_id)
        if artist is None:
            raise NotFoundError("Artist not found")
        if artist.user_id == customer.id:
            raise ValidationError("You can't book your own services")
        service = await self.bookings.approved_service(data.service_id, artist.id)
        if service is None:
            raise NotFoundError("Service not found")

        rules.check_bookable_start(data.start_at, now)
        # Settle this artist's unanswered requests first: an expired one must not hold its slot (nor trip the
        # database's no-overlap constraint, which only knows the stored status).
        await self.bookings.expire_overdue(now, Booking.artist_id == artist.id)
        await self._check_open_requests(customer, now)
        end = data.start_at + timedelta(minutes=service.duration_minutes)
        if await self.bookings.busy_ranges(artist.id, data.start_at, end, now):
            raise ConflictError("That time was just taken. Pick another slot.")

        p = rules.price(service.price_paise)
        provider = self.settings.payment_provider
        booking = Booking(
            code=new_code(),
            customer_id=customer.id,
            artist_id=artist.id,
            service_id=service.id,
            service_name=service.display_name,
            duration_minutes=service.duration_minutes,
            start_at=data.start_at,
            end_at=end,
            address=data.address,
            note=data.note,
            subtotal_paise=p.subtotal_paise,
            platform_fee_paise=p.platform_fee_paise,
            total_paise=p.total_paise,
            deposit_paise=p.deposit_paise,
            commission_paise=p.commission_paise,
            # "direct": the customer pays the artist's UPI, so the platform never marks money as received.
            # "mock" (never in production) counts the deposit as paid.
            deposit_paid_at=now if provider == "mock" else None,
            payment_provider=provider,
            expires_at=rules.accept_deadline(now, data.start_at),
        )
        self.bookings.add(booking)
        try:
            await self.session.flush()
        except IntegrityError as exc:  # ex_booking_no_overlap: only reachable if a write skipped the artist lock
            raise ConflictError("That time was just taken. Pick another slot.") from exc
        return await self.save(booking.id, view="customer")

    async def _check_open_requests(self, customer: User, now: datetime) -> None:
        # Lock the customer row too: their concurrent requests (to different artists) queue here,
        # so two of them can't both pass the cap.
        await self.bookings.lock_customer(customer.id)
        cap = self.settings.max_open_requests_per_customer
        if await self.bookings.open_request_count(customer.id, now) >= cap:
            raise ConflictError(f"You have {cap} requests waiting for an answer. Wait for a reply or cancel one first.")

    async def customer_list(self, customer: User, scope: CustomerScope, limit: int, cursor: str | None):
        mine = Booking.customer_id == customer.id
        await self.expire_overdue(mine)
        upcoming = and_(Booking.status.in_(OPEN), Booking.end_at > self.clock.now())
        where = [mine, upcoming if scope == "upcoming" else not_(upcoming)]
        return await self.page(where, Booking.start_at, scope == "past", limit, cursor, view="customer")

    async def customer_get(self, customer: User, booking_id: uuid.UUID) -> dict[str, Any]:
        await self.expire_overdue(Booking.id == booking_id)
        return await self.one(booking_id, Booking.customer_id == customer.id, view="customer")

    async def customer_cancel(self, customer: User, booking_id: uuid.UUID, reason: str | None) -> dict[str, Any]:
        mine = Booking.customer_id == customer.id
        booking = await self.locked(booking_id, mine)
        self.require(booking, *OPEN)
        now = self.clock.now()
        if now >= booking.start_at:
            raise ConflictError("This booking has already started")
        booking.status = BookingStatus.cancelled
        booking.cancelled_at = now
        booking.cancelled_by = "customer"
        booking.cancel_reason = clean_reason(reason)
        booking.refund_due = rules.customer_refund_due(booking.start_at, now)
        return await self.save(booking_id, mine, view="customer")

    # --- artist ---------------------------------------------------------------------------------

    async def artist_id(self, user: User) -> uuid.UUID:
        return await approved_artist_id(self.session, user)

    async def artist_list(
        self,
        user: User,
        scope: ArtistScope | None,
        first: date | None,
        last: date | None,
        limit: int,
        cursor: str | None,
    ):
        theirs = Booking.artist_id == await self.artist_id(user)
        await self.expire_overdue(theirs)
        where = [theirs]
        for day in (first, last):
            if day is not None:
                rules.check_calendar_day(day, self.clock.now())
        if first:
            where.append(Booking.start_at >= rules.ist_day_bounds(first, first)[0])
        if last:
            where.append(Booking.start_at < rules.ist_day_bounds(last, last)[1])
        if scope == "requests":
            where.append(Booking.status == BookingStatus.requested)
            return await self.page(where, Booking.expires_at, False, limit, cursor, view="artist")
        if scope == "upcoming":
            where.append(Booking.status == BookingStatus.confirmed)
        elif scope == "past":
            where.append(Booking.status.not_in(OPEN))
        return await self.page(where, Booking.start_at, scope == "past", limit, cursor, view="artist")

    async def _artist_locked(self, user: User, booking_id: uuid.UUID) -> tuple[Booking, ColumnElement[bool]]:
        theirs = Booking.artist_id == await self.artist_id(user)
        return await self.locked(booking_id, theirs), theirs

    async def accept(self, user: User, booking_id: uuid.UUID) -> dict[str, Any]:
        booking, theirs = await self._artist_locked(user, booking_id)
        self.require(booking, BookingStatus.requested)
        booking.status = BookingStatus.confirmed
        booking.responded_at = self.clock.now()
        return await self.save(booking_id, theirs, view="artist")

    async def decline(self, user: User, booking_id: uuid.UUID, reason: str | None) -> dict[str, Any]:
        booking, theirs = await self._artist_locked(user, booking_id)
        self.require(booking, BookingStatus.requested)
        booking.status = BookingStatus.declined
        booking.responded_at = self.clock.now()
        booking.decline_reason = clean_reason(reason)
        booking.refund_due = True
        return await self.save(booking_id, theirs, view="artist")

    async def complete(self, user: User, booking_id: uuid.UUID) -> dict[str, Any]:
        booking, theirs = await self._artist_locked(user, booking_id)
        self.require(booking, BookingStatus.confirmed)
        now = self.clock.now()
        if now < booking.start_at:
            raise ConflictError("You can mark it completed once it has started")
        booking.status = BookingStatus.completed
        booking.completed_at = now
        return await self.save(booking_id, theirs, view="artist")

    async def dashboard(self, user: User) -> dict[str, Any]:
        theirs = Booking.artist_id == await self.artist_id(user)
        await self.expire_overdue(theirs)
        now = self.clock.now()
        completed_this_month = and_(
            Booking.status == BookingStatus.completed, Booking.completed_at >= ist_month_start(now)
        )
        day_start, day_end = rules.ist_day_bounds(rules.ist_today(now), rules.ist_today(now))
        today_rows = await self.bookings.rows_starting_between(
            day_start, day_end, theirs, Booking.status.in_((BookingStatus.confirmed, BookingStatus.completed))
        )
        return {
            "requests": await self.bookings.count(Booking, theirs, Booking.status == BookingStatus.requested),
            # same rule as the Upcoming list
            "upcoming": await self.bookings.count(Booking, theirs, Booking.status == BookingStatus.confirmed),
            "completed_this_month": await self.bookings.count(Booking, theirs, completed_this_month),
            "earnings_this_month_paise": await self.bookings.artist_earnings(theirs, completed_this_month),
            "today": [self.out(r, "artist") for r in today_rows],
        }
