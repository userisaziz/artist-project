"""Bookings for customers and artists: request a slot, accept, decline, complete, cancel, and move (reschedule).

Unanswered requests expire lazily: each read or write first marks overdue requests `expired` and drops
unanswered asks to move a booking.
Writes commit before returning, because `get_db` commits only after the response is sent and a
customer must never see "requested" for a booking that wasn't saved.
"""

import uuid
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from typing import Any, Literal

from sqlalchemy import ColumnElement, and_, not_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import InstrumentedAttribute

from app.artist import schedule_service as artist_schedule
from app.artist.constants import PricingUnit
from app.artist.models import ArtistServiceItem
from app.booking import notices, rules
from app.booking.config import BookingSettings
from app.booking.mapper import View, booking_out
from app.booking.models import Booking, BookingAddon
from app.booking.repository import CLEARED_RESCHEDULE, BookingRepository, BookingRow
from app.booking.repository import reschedule_pending as reschedule_pending_clause
from app.booking.schemas import BookingAddonIn, BookingIn
from app.booking.utils import clean_reason, ist_month_start, new_code, reschedule_pending, shift_month
from app.catalog import fields as catalog_fields
from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.quote.constants import EnquiryStatus
from app.quote.models import QuoteEnquiry
from app.requirement import constants as requirement_constants
from app.requirement import service as requirement_service
from app.review.repository import ReviewRepository
from app.shared.clock import Clock
from app.shared.enums import ArtistStatus, BookingStatus
from app.shared.pagination import split_page
from app.upload.service import ImageStorage
from app.user.models import User

OPEN = (BookingStatus.requested, BookingStatus.confirmed)
Canceller = Literal["customer", "artist", "admin"]  # Booking.cancelled_by
ACCOUNT_DELETED = "Account deleted"
TAKEN = "That time was just taken. Pick another."
TAKEN_SLOT = "That time was just taken. Pick another slot."  # a new request
CUSTOM_QUOTE = "Custom quote"  # service_name of a booking made from an accepted quote
NOT_ASKED = "No change was asked for"
CustomerScope = Literal["upcoming", "past"]
ArtistScope = Literal["requests", "upcoming", "past"]


async def approved_artist_id(session: AsyncSession, user: User) -> uuid.UUID:
    """The caller's artist profile id; bookings and reviews open only once it's approved."""
    artist = await BookingRepository(session).artist_of(user.id)
    if artist is None:
        raise NotFoundError("No artist profile yet")
    if artist.status != ArtistStatus.approved:
        raise ConflictError("Bookings open once your profile is approved")
    return artist.id


def clear_reschedule(booking: Booking) -> None:
    for column, value in CLEARED_RESCHEDULE.items():
        setattr(booking, column, value)


def mark_cancelled(booking: Booking, now: datetime, by: Canceller, reason: str | None, refund_due: bool) -> None:
    booking.status = BookingStatus.cancelled
    booking.cancelled_at = now
    booking.cancelled_by = by
    booking.cancel_reason = reason
    booking.refund_due = refund_due if booking.deposit_paise else None
    clear_reschedule(booking)  # a cancelled booking has nothing left to move


async def cancel_upcoming_for_deleted_account(
    session: AsyncSession, now: datetime, customer_id: uuid.UUID, artist_id: uuid.UUID | None
) -> None:
    """A deleted account calls off everything still ahead: as the customer and, if they have one, as the artist.
    The other side is told. Overdue requests expire first, as on every read."""
    repo = BookingRepository(session)
    sides: list[tuple[Canceller, ColumnElement[bool]]] = [("customer", Booking.customer_id == customer_id)]
    if artist_id is not None:
        sides.append(("artist", Booking.artist_id == artist_id))
    for by, theirs in sides:
        await repo.expire_overdue(now, theirs)
        for booking in await repo.locked_upcoming(now, theirs):
            # Same refund rule as the side cancelling it by hand; an artist pulling out always owes it back.
            refund = rules.customer_refund_due(booking.start_at, now) if by == "customer" else True
            mark_cancelled(booking, now, by, ACCOUNT_DELETED, refund)
            await notices.cancelled(session, booking, by)


@dataclass(frozen=True)
class NewBooking:
    """What a new booking is made of; money is worked out from `price_paise` by the usual pricing rules."""

    customer_id: uuid.UUID
    artist_id: uuid.UUID
    service_id: uuid.UUID | None
    service_name: str
    duration_minutes: int
    start_at: datetime
    address: str
    note: str | None
    price_paise: int  # the service (times guests when per person) plus any add-on lines
    addons: tuple[BookingAddon, ...] = ()
    quantity: int = 1
    answers: tuple[dict[str, Any], ...] = ()


def addon_lines(service: ArtistServiceItem, picks: list[BookingAddonIn]) -> tuple[BookingAddon, ...]:
    """The customer's picks as booking lines priced from the service's add-ons; anything off-menu is refused."""
    offered = {a.id: a for a in service.addons}
    if len({p.addon_id for p in picks}) != len(picks):
        raise ValidationError("Pick each add-on once")
    lines = []
    for position, pick in enumerate(picks):
        addon = offered.get(pick.addon_id)
        if addon is None:
            raise ValidationError("That add-on isn't offered with this service")
        if not addon.per_person and pick.guests != 1:
            raise ValidationError(f"“{addon.name}” isn't priced per person")
        lines.append(
            BookingAddon(
                addon_id=addon.id,
                name=addon.name,
                unit_price_paise=addon.price_paise,
                per_person=addon.per_person,
                guests=pick.guests,
                line_paise=addon.price_paise * pick.guests,
                sort_order=position,
            )
        )
    return tuple(lines)


UNIT_PLURAL = {"person": "people", "piece": "pieces", "box": "boxes", "card": "cards", "hour": "hours", "set": "sets"}


def check_quantity(service: ArtistServiceItem, quantity: int) -> None:
    """A package is booked once; a per-unit service from its minimum quantity (people, pieces, boxes…)."""
    if service.pricing_unit != PricingUnit.per_unit:
        if quantity != 1:
            raise ValidationError("This service is priced as a whole, not per unit")
        return
    if quantity < service.min_quantity:
        unit = UNIT_PLURAL.get(service.quantity_unit or "", "units")
        raise ValidationError(f"The minimum is {service.min_quantity} {unit}")


def new_booking(settings: BookingSettings, now: datetime, data: NewBooking) -> Booking:
    """An unsaved `requested` booking with its money copied in at request time."""
    p = rules.price(data.price_paise)
    provider = settings.payment_provider
    direct = provider == "direct"
    return Booking(
        code=new_code(),
        customer_id=data.customer_id,
        artist_id=data.artist_id,
        service_id=data.service_id,
        service_name=data.service_name,
        duration_minutes=data.duration_minutes,
        start_at=data.start_at,
        end_at=data.start_at + timedelta(minutes=data.duration_minutes),
        address=data.address,
        note=data.note,
        quantity=data.quantity,
        answers=list(data.answers),
        status=BookingStatus.requested,
        subtotal_paise=p.subtotal_paise,
        # Phase 1 ("direct"): no in-app payments, so no platform fee and no deposit; the customer pays the
        # artist the service price after the service.
        platform_fee_paise=0 if direct else p.platform_fee_paise,
        total_paise=p.subtotal_paise if direct else p.total_paise,
        deposit_paise=0 if direct else p.deposit_paise,
        commission_paise=p.commission_paise,
        addons=list(data.addons),
        # "direct": the customer pays the artist's UPI, so the platform never marks money as received.
        # "mock" (never in production) counts the deposit as paid.
        deposit_paid_at=now if provider == "mock" else None,
        payment_provider=provider,
        expires_at=rules.accept_deadline(now, data.start_at),
    )


async def check_free(
    repo: BookingRepository, artist_id: uuid.UUID, start: datetime, end: datetime, now: datetime, taken: str
) -> None:
    """Call under the artist row lock, after expiring their overdue requests."""
    if await repo.busy_ranges(artist_id, start, end, now):
        raise ConflictError(taken)


async def insert(session: AsyncSession, booking: Booking, taken: str) -> None:
    BookingRepository(session).add(booking)
    try:
        await session.flush()
    except IntegrityError as exc:  # ex_booking_no_overlap: only reachable if a write skipped the artist lock
        raise ConflictError(taken) from exc


async def lock_bookable_artist(session: AsyncSession, artist_id: uuid.UUID) -> uuid.UUID | None:
    """Row-lock an approved artist (new bookings for one artist queue here); their account id, or None."""
    artist = await BookingRepository(session).lock_approved_artist(artist_id)
    return artist.user_id if artist else None


async def create_from_quote(
    session: AsyncSession,
    settings: BookingSettings,
    now: datetime,
    *,
    customer_id: uuid.UUID,
    artist_id: uuid.UUID,
    start_at: datetime,
    duration_minutes: int,
    price_paise: int,
    address: str,
    note: str | None,
    service_id: uuid.UUID | None = None,
    service_name: str | None = None,
    answers: tuple[dict[str, Any], ...] = (),
) -> Booking:
    """A booking the artist already agreed to (an accepted quote): confirmed at once, with no service behind it,
    for a start inside their hours that is free. Same slot rules, overlap guard, pricing and commission as a
    request. The caller holds the artist lock (`lock_bookable_artist`, taken before anything else it locks) and
    tells the artist."""
    data = NewBooking(
        customer_id=customer_id,
        artist_id=artist_id,
        service_id=service_id,
        service_name=service_name or CUSTOM_QUOTE,
        duration_minutes=duration_minutes,
        start_at=start_at,
        address=address,
        note=note,
        price_paise=price_paise,
        answers=answers,
    )
    repo = BookingRepository(session)
    try:
        hours = await artist_schedule.open_hours(session, data.artist_id, rules.start_day(data.start_at))
        rules.check_bookable_start(data.start_at, now, hours, data.duration_minutes)
    except ValidationError as exc:
        raise ValidationError("Pick one of the offered times") from exc
    end = data.start_at + timedelta(minutes=data.duration_minutes)
    await repo.expire_overdue(now, Booking.artist_id == data.artist_id)
    await check_free(repo, data.artist_id, data.start_at, end, now, TAKEN)
    booking = new_booking(settings, now, data)
    booking.status = BookingStatus.confirmed
    booking.responded_at = now
    await insert(session, booking, TAKEN)
    return booking


DASHBOARD_TREND_MONTHS = 6
DASHBOARD_WEEK_DAYS = 7
DASHBOARD_EXPIRING_HOURS = 6


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
        if await requirement_service.is_on_hold(self.session, artist.id):
            raise ConflictError(requirement_constants.NOT_TAKING_REQUESTS)
        service = await self.bookings.approved_service(data.service_id, artist.id)
        if service is None:
            raise NotFoundError("Service not found")
        addons = addon_lines(service, data.addons)
        service_rules = await catalog_fields.rules_for(self.session, service.category_id)
        if service_rules.fulfilment == catalog_fields.Fulfilment.made_to_order:
            raise ConflictError("This is made to order: ask the artist for a quote instead")
        check_quantity(service, data.quantity)
        booking_fields = service_rules.scoped(catalog_fields.FieldScope.booking)
        answers = catalog_fields.answer_snapshot(
            booking_fields, catalog_fields.validate_values(booking_fields, data.answers)
        )

        day = rules.start_day(data.start_at)
        rules.check_bookable_day(day, now)
        hours = await artist_schedule.open_hours(self.session, artist.id, day)
        rules.check_bookable_start(data.start_at, now, hours, service.duration_minutes)
        # Settle this artist's unanswered requests first: an expired one must not hold its slot (nor trip the
        # database's no-overlap constraint, which only knows the stored status).
        await self.bookings.expire_overdue(now, Booking.artist_id == artist.id)
        await self._check_open_requests(customer, now)
        end = data.start_at + timedelta(minutes=service.duration_minutes)
        await check_free(self.bookings, artist.id, data.start_at, end, now, TAKEN_SLOT)
        booking = new_booking(
            self.settings,
            now,
            NewBooking(
                customer_id=customer.id,
                artist_id=artist.id,
                service_id=service.id,
                service_name=service.display_name,
                duration_minutes=service.duration_minutes,
                start_at=data.start_at,
                address=data.address,
                note=data.note,
                price_paise=service.price_paise * data.quantity + sum(line.line_paise for line in addons),
                addons=addons,
                quantity=data.quantity,
                answers=tuple(answers),
            ),
        )
        await insert(self.session, booking, TAKEN_SLOT)
        await notices.requested(self.session, booking, artist.user_id)
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
        mark_cancelled(booking, now, "customer", clean_reason(reason), rules.customer_refund_due(booking.start_at, now))
        await notices.cancelled(self.session, booking, "customer")
        return await self.save(booking_id, mine, view="customer")

    async def request_reschedule(self, customer: User, booking_id: uuid.UUID, start: datetime) -> dict[str, Any]:
        """Ask the artist to move a confirmed booking that hasn't started. It keeps its time until they accept;
        the asked-for range is held for them meanwhile."""
        mine = Booking.customer_id == customer.id
        booking = await self.locked_for_move(booking_id, mine)
        now = self.clock.now()
        if booking.status != BookingStatus.confirmed or now >= booking.start_at:
            raise ConflictError("This booking can't be moved")
        if reschedule_pending(booking, now):
            raise ConflictError("You've already asked to move this booking")
        if start == booking.start_at:
            raise ValidationError("Pick a different time from the current one")
        await self._check_bookable(booking, start, now)
        end = start + timedelta(minutes=booking.duration_minutes)
        if await self.bookings.busy_ranges(booking.artist_id, start, end, now, excluding=booking.id):
            raise ConflictError(TAKEN)
        booking.reschedule_start_at = start
        booking.reschedule_end_at = end
        booking.reschedule_requested_at = now
        booking.reschedule_expires_at = rules.reschedule_deadline(now, booking.start_at, start)
        booking.reschedule_declined_reason = None
        await notices.reschedule_requested(self.session, booking, start)
        return await self.save(booking_id, mine, view="customer")

    async def _check_bookable(self, booking: Booking, start: datetime, now: datetime) -> None:
        """The same slot rules as a new booking (the artist's hours and days off, lead time, horizon), with one
        message: the app only offers slots from the availability grid."""
        try:
            hours = await artist_schedule.open_hours(self.session, booking.artist_id, rules.start_day(start))
            rules.check_bookable_start(start, now, hours, booking.duration_minutes)
        except ValidationError as exc:
            raise ValidationError("Pick one of the offered times") from exc

    async def withdraw_reschedule(self, customer: User, booking_id: uuid.UUID) -> dict[str, Any]:
        """Take back a pending ask; nothing to do when there is none."""
        mine = Booking.customer_id == customer.id
        booking = await self.locked(booking_id, mine)
        clear_reschedule(booking)
        return await self.save(booking_id, mine, view="customer")

    async def locked_for_move(self, booking_id: uuid.UUID, *scope: ColumnElement[bool]) -> Booking:
        """Like `locked`, but first row-locks the booking's artist, as `create` does: moves and new requests for
        one artist queue behind each other, so the held-range check is reliable. Artist before booking, always."""
        await self.expire_overdue(Booking.id == booking_id)
        artist_id = await self.bookings.artist_of_booking(booking_id, *scope)
        if artist_id is None:
            raise NotFoundError("Booking not found")
        await self.bookings.lock_artist(artist_id)
        booking = await self.bookings.locked(booking_id, *scope)
        if booking is None:
            raise NotFoundError("Booking not found")
        return booking

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

    async def artist_get(self, user: User, booking_id: uuid.UUID) -> dict[str, Any]:
        await self.expire_overdue(Booking.id == booking_id)
        return await self.one(booking_id, Booking.artist_id == await self.artist_id(user), view="artist")

    async def _artist_locked(self, user: User, booking_id: uuid.UUID) -> tuple[Booking, ColumnElement[bool]]:
        theirs = Booking.artist_id == await self.artist_id(user)
        return await self.locked(booking_id, theirs), theirs

    async def accept(self, user: User, booking_id: uuid.UUID) -> dict[str, Any]:
        booking, theirs = await self._artist_locked(user, booking_id)
        self.require(booking, BookingStatus.requested)
        booking.status = BookingStatus.confirmed
        booking.responded_at = self.clock.now()
        await notices.answered(self.session, booking, accepted=True)
        return await self.save(booking_id, theirs, view="artist")

    async def decline(self, user: User, booking_id: uuid.UUID, reason: str | None) -> dict[str, Any]:
        booking, theirs = await self._artist_locked(user, booking_id)
        self.require(booking, BookingStatus.requested)
        booking.status = BookingStatus.declined
        booking.responded_at = self.clock.now()
        booking.decline_reason = clean_reason(reason)
        booking.refund_due = True if booking.deposit_paise else None
        await notices.answered(self.session, booking, accepted=False)
        return await self.save(booking_id, theirs, view="artist")

    async def accept_reschedule(self, user: User, booking_id: uuid.UUID) -> dict[str, Any]:
        """Move the booking to the asked-for time, if it is still free."""
        theirs = Booking.artist_id == await self.artist_id(user)
        booking = await self.locked_for_move(booking_id, theirs)
        now = self.clock.now()
        start, end = booking.reschedule_start_at, booking.reschedule_end_at
        if not reschedule_pending(booking, now) or start is None or end is None:
            raise ConflictError(NOT_ASKED)
        if await self.bookings.busy_ranges(booking.artist_id, start, end, now, excluding=booking.id):
            raise ConflictError(TAKEN)
        booking.start_at, booking.end_at = start, end
        clear_reschedule(booking)
        try:
            await self.session.flush()
        except IntegrityError as exc:  # ex_booking_no_overlap: only reachable if a write skipped the artist lock
            raise ConflictError(TAKEN) from exc
        await notices.reschedule_answered(self.session, booking, accepted=True)
        return await self.save(booking_id, theirs, view="artist")

    async def decline_reschedule(self, user: User, booking_id: uuid.UUID, reason: str | None) -> dict[str, Any]:
        """Keep the booking's time; the customer sees the reason."""
        booking, theirs = await self._artist_locked(user, booking_id)
        if not reschedule_pending(booking, self.clock.now()):
            raise ConflictError(NOT_ASKED)
        clear_reschedule(booking)
        booking.reschedule_declined_reason = clean_reason(reason)
        await notices.reschedule_answered(self.session, booking, accepted=False)
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

    async def earnings(self, user: User, months: int) -> dict[str, Any]:
        """Completed bookings and earnings for this IST month and the `months - 1` before it, newest first.
        Paid to the artist directly (phase 1), so this is a record, not a payout."""
        theirs = Booking.artist_id == await self.artist_id(user)
        first = ist_month_start(self.clock.now()).date()
        starts = [shift_month(first, -i) for i in range(months)]
        since = datetime.combine(starts[-1], time(), tzinfo=rules.IST)
        totals = await self.bookings.monthly_earnings(since, theirs)
        return {
            "months": [
                {
                    "month": m.strftime("%Y-%m"),
                    "bookings": totals.get(m, (0, 0))[0],
                    "earnings_paise": totals.get(m, (0, 0))[1],
                }
                for m in starts
            ]
        }

    async def dashboard(self, user: User) -> dict[str, Any]:
        """The artist home: what needs action now, this month against last, a six-month trend and today's agenda."""
        artist_id = await self.artist_id(user)
        theirs = Booking.artist_id == artist_id
        await self.expire_overdue(theirs)
        now = self.clock.now()
        month_start = ist_month_start(now)
        last_month_start = datetime.combine(shift_month(month_start.date(), -1), time(), tzinfo=rules.IST)
        completed = Booking.status == BookingStatus.completed
        completed_this_month = and_(completed, Booking.completed_at >= month_start)
        completed_last_month = and_(
            completed, Booking.completed_at >= last_month_start, Booking.completed_at < month_start
        )
        today = rules.ist_today(now)
        day_start, day_end = rules.ist_day_bounds(today, today)
        _, week_end = rules.ist_day_bounds(today, today + timedelta(days=DASHBOARD_WEEK_DAYS - 1))
        today_rows = await self.bookings.rows_starting_between(
            day_start, day_end, theirs, Booking.status.in_((BookingStatus.confirmed, BookingStatus.completed))
        )
        firsts = [shift_month(month_start.date(), -i) for i in range(DASHBOARD_TREND_MONTHS)]
        since = datetime.combine(firsts[-1], time(), tzinfo=rules.IST)
        totals = await self.bookings.monthly_earnings(since, theirs)
        ratings = await ReviewRepository(self.session).averages([artist_id])
        rating, review_count = (round(float(ratings[0][1]), 1), ratings[0][2]) if ratings else (None, 0)
        return {
            "requests": await self.bookings.count(Booking, theirs, Booking.status == BookingStatus.requested),
            "requests_expiring_soon": await self.bookings.count(
                Booking,
                theirs,
                Booking.status == BookingStatus.requested,
                Booking.expires_at <= now + timedelta(hours=DASHBOARD_EXPIRING_HOURS),
            ),
            "reschedules_pending": await self.bookings.count(Booking, theirs, reschedule_pending_clause(now)),
            "enquiries_open": await self.bookings.count(
                QuoteEnquiry, QuoteEnquiry.artist_id == artist_id, QuoteEnquiry.status == EnquiryStatus.open
            ),
            # same rule as the Upcoming list
            "upcoming": await self.bookings.count(Booking, theirs, Booking.status == BookingStatus.confirmed),
            "upcoming_this_week": await self.bookings.count(
                Booking,
                theirs,
                Booking.status == BookingStatus.confirmed,
                Booking.start_at >= now,
                Booking.start_at < week_end,
            ),
            "completed_this_month": await self.bookings.count(Booking, theirs, completed_this_month),
            "earnings_this_month_paise": await self.bookings.artist_earnings(theirs, completed_this_month),
            "completed_last_month": await self.bookings.count(Booking, theirs, completed_last_month),
            "earnings_last_month_paise": await self.bookings.artist_earnings(theirs, completed_last_month),
            "rating": rating,
            "review_count": review_count,
            # oldest first, so it reads left to right as a chart
            "trend": [
                {
                    "month": m.strftime("%Y-%m"),
                    "bookings": totals.get(m, (0, 0))[0],
                    "earnings_paise": totals.get(m, (0, 0))[1],
                }
                for m in reversed(firsts)
            ],
            "today": [self.out(r, "artist") for r in today_rows],
        }
