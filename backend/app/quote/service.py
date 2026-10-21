"""Enquiries and quotes: a customer asks an approved artist for a custom job, the artist quotes (and may re-quote)
or declines, and the customer accepts by picking a free start, which books it as a confirmed booking.

Lapsed enquiries expire lazily: every read or write first marks the caller's live enquiries past their event
date, or quoted past the quote's valid-until date, as expired. Writes commit before returning, as bookings do.
"""

import uuid
from datetime import date, datetime
from typing import Any

from sqlalchemy import ColumnElement
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.booking import availability as booking_availability
from app.booking import rules as booking_rules
from app.booking import service as booking_service
from app.booking.config import BookingSettings
from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.quote import notices
from app.quote.config import QuoteSettings
from app.quote.constants import CLOSED, DUPLICATE, LIVE, NOT_ACCEPTABLE, ArtistView, EnquiryStatus
from app.quote.models import QuoteEnquiry
from app.quote.repository import EnquiryRow, QuoteRepository
from app.quote.schemas import AcceptIn, EnquiryIn, QuoteIn
from app.shared.clock import Clock
from app.shared.pagination import split_page
from app.upload.service import ImageStorage
from app.user.models import User

ARTIST_VIEWS: dict[ArtistView, ColumnElement[bool]] = {
    "open": QuoteEnquiry.status == EnquiryStatus.open,
    "quoted": QuoteEnquiry.status == EnquiryStatus.quoted,
    "closed": QuoteEnquiry.status.in_(CLOSED),
}


def enquiry_out(row: EnquiryRow, storage: ImageStorage) -> dict[str, Any]:
    """The same shape for both sides; the customer is shown by name only."""
    e = row.enquiry
    quote = None
    if e.quoted_at is not None:
        quote = {
            "price_paise": e.quote_price_paise,
            "duration_minutes": e.quote_duration_minutes,
            "note": e.quote_note,
            "valid_until": e.quote_valid_until_date,
            "quoted_at": e.quoted_at,
        }
    return {
        "id": e.id,
        "status": e.status,
        "event_date": e.event_date,
        "details": e.details,
        "budget_paise": e.budget_paise,
        "created_at": e.created_at,
        "artist": {
            "id": e.artist_id,
            "business_name": row.business_name,
            "photo_url": storage.url(row.photo_key, "thumb") if row.photo_key else None,
            "city": row.city,
        },
        "customer": {"first_name": row.first_name, "last_name": row.last_name},
        "quote": quote,
        "decline_reason": e.decline_reason,
        "booking_id": e.booking_id,
    }


async def cancel_live_for_deleted_account(
    session: AsyncSession, now: datetime, customer_id: uuid.UUID, artist_id: uuid.UUID | None
) -> None:
    """A deleted account withdraws its open and quoted enquiries, as the customer and (if any) as the artist.
    Lapsed ones expire first, as on every read. Nobody is notified."""
    repo = QuoteRepository(session)
    today = booking_rules.ist_today(now)
    sides = [QuoteEnquiry.customer_id == customer_id]
    if artist_id is not None:
        sides.append(QuoteEnquiry.artist_id == artist_id)
    for theirs in sides:
        await repo.expire_lapsed(today, theirs)
        await repo.cancel_live(now, theirs)


class QuoteService:
    def __init__(
        self,
        session: AsyncSession,
        storage: ImageStorage,
        settings: QuoteSettings,
        booking_settings: BookingSettings,
        clock: Clock,
    ):
        self.session = session
        self.enquiries = QuoteRepository(session)
        self.storage = storage
        self.settings = settings
        self.booking_settings = booking_settings
        self.clock = clock

    # --- shared ---------------------------------------------------------------------------------

    def today(self) -> date:
        return booking_rules.ist_today(self.clock.now())

    async def expire_lapsed(self, *scope: ColumnElement[bool]) -> None:
        """Committed at once, so reads don't hold these row locks until after the response."""
        await self.enquiries.expire_lapsed(self.today(), *scope)
        await self.session.commit()

    async def one(self, enquiry_id: uuid.UUID, *scope: ColumnElement[bool]) -> dict[str, Any]:
        row = await self.enquiries.row(enquiry_id, *scope)
        if row is None:
            raise NotFoundError("Enquiry not found")
        return enquiry_out(row, self.storage)

    async def get(self, enquiry_id: uuid.UUID, scope: ColumnElement[bool]) -> dict[str, Any]:
        await self.expire_lapsed(QuoteEnquiry.id == enquiry_id)
        return await self.one(enquiry_id, scope)

    async def page(self, where: list[ColumnElement[bool]], limit: int, cursor: str | None):
        rows = await self.enquiries.page_rows(where, limit, cursor)
        page, next_cursor = split_page(rows, limit, lambda r: (r.enquiry.created_at, r.enquiry.id))
        return [enquiry_out(r, self.storage) for r in page], next_cursor

    async def locked(self, enquiry_id: uuid.UUID, scope: ColumnElement[bool]) -> QuoteEnquiry:
        """Row-locked; someone else's enquiry reads as missing (404, never 403)."""
        await self.expire_lapsed(QuoteEnquiry.id == enquiry_id)
        enquiry = await self.enquiries.locked(enquiry_id, scope)
        if enquiry is None:
            raise NotFoundError("Enquiry not found")
        return enquiry

    @staticmethod
    def require_live(enquiry: QuoteEnquiry) -> None:
        if enquiry.status not in LIVE:
            raise ConflictError(f"This enquiry is already {enquiry.status.value}")

    async def save(self, enquiry_id: uuid.UUID, scope: ColumnElement[bool]) -> dict[str, Any]:
        await self.session.commit()
        return await self.one(enquiry_id, scope)

    # --- customer -------------------------------------------------------------------------------

    async def create(self, customer: User, data: EnquiryIn) -> dict[str, Any]:
        booking_rules.check_bookable_day(data.event_date, self.clock.now())
        artist = await self.enquiries.approved_artist(data.artist_id)
        if artist is None:
            raise NotFoundError("Artist not found")
        if artist.user_id == customer.id:
            raise ValidationError("You can't send an enquiry to yourself")
        mine = QuoteEnquiry.customer_id == customer.id
        await self.enquiries.lock_customer(customer.id)
        await self.enquiries.expire_lapsed(self.today(), mine)
        live = QuoteEnquiry.status.in_(LIVE)
        if await self.enquiries.count(mine, live, QuoteEnquiry.artist_id == artist.id):
            raise ConflictError(DUPLICATE)
        cap = self.settings.max_open_enquiries_per_customer
        if await self.enquiries.count(mine, live) >= cap:
            raise ConflictError(f"You have {cap} open enquiries. Wait for replies or cancel one first.")
        enquiry = QuoteEnquiry(
            customer_id=customer.id,
            artist_id=artist.id,
            status=EnquiryStatus.open,
            event_date=data.event_date,
            details=data.details,
            budget_paise=data.budget_paise,
        )
        self.enquiries.add(enquiry)
        try:
            await self.session.flush()
        except IntegrityError as exc:  # uq_quote_enquiry_live_customer_artist: only if a write skipped the lock
            raise ConflictError(DUPLICATE) from exc
        await notices.received(self.session, enquiry, artist.user_id)
        return await self.save(enquiry.id, mine)

    async def customer_list(self, customer: User, limit: int, cursor: str | None):
        mine = QuoteEnquiry.customer_id == customer.id
        await self.expire_lapsed(mine)
        return await self.page([mine], limit, cursor)

    async def customer_get(self, customer: User, enquiry_id: uuid.UUID) -> dict[str, Any]:
        return await self.get(enquiry_id, QuoteEnquiry.customer_id == customer.id)

    async def cancel(self, customer: User, enquiry_id: uuid.UUID) -> dict[str, Any]:
        mine = QuoteEnquiry.customer_id == customer.id
        enquiry = await self.locked(enquiry_id, mine)
        self.require_live(enquiry)
        enquiry.status = EnquiryStatus.cancelled
        enquiry.closed_at = self.clock.now()
        return await self.save(enquiry_id, mine)

    async def availability(self, customer: User, enquiry_id: uuid.UUID, day: date) -> dict[str, Any]:
        """The artist's slot grid for the quoted duration; only while the quote can be accepted."""
        mine = QuoteEnquiry.customer_id == customer.id
        await self.expire_lapsed(QuoteEnquiry.id == enquiry_id)
        row = await self.enquiries.row(enquiry_id, mine)
        if row is None:
            raise NotFoundError("Enquiry not found")
        e = row.enquiry
        if e.status != EnquiryStatus.quoted or e.quote_duration_minutes is None:
            raise ConflictError(NOT_ACCEPTABLE)
        return await booking_availability.day_slots(
            self.session, e.artist_id, day, e.quote_duration_minutes, self.clock.now()
        )

    async def accept(self, customer: User, enquiry_id: uuid.UUID, data: AcceptIn) -> dict[str, Any]:
        """Book the quote: a confirmed booking at the quoted price and duration. Locks the artist before the
        enquiry, the same order as every booking write, so accepts and new requests for one artist queue."""
        mine = QuoteEnquiry.customer_id == customer.id
        await self.expire_lapsed(QuoteEnquiry.id == enquiry_id)
        artist_id = await self.enquiries.artist_of(enquiry_id, mine)
        if artist_id is None:
            raise NotFoundError("Enquiry not found")
        artist_user = await booking_service.lock_bookable_artist(self.session, artist_id)
        enquiry = await self.enquiries.locked(enquiry_id, mine)
        if enquiry is None:
            raise NotFoundError("Enquiry not found")
        price, duration = enquiry.quote_price_paise, enquiry.quote_duration_minutes
        if artist_user is None or enquiry.status != EnquiryStatus.quoted or price is None or duration is None:
            raise ConflictError(NOT_ACCEPTABLE)
        now = self.clock.now()
        booking = await booking_service.create_from_quote(
            self.session,
            self.booking_settings,
            now,
            customer_id=customer.id,
            artist_id=artist_id,
            start_at=data.start_at,
            duration_minutes=duration,
            price_paise=price,
            address=data.address,
            note=data.note,
        )
        enquiry.status = EnquiryStatus.accepted
        enquiry.booking_id = booking.id
        enquiry.closed_at = now
        await notices.accepted(self.session, enquiry, artist_user, booking.id)
        return {"enquiry": await self.save(enquiry_id, mine), "booking_id": booking.id}

    # --- artist ---------------------------------------------------------------------------------

    async def _theirs(self, user: User) -> ColumnElement[bool]:
        return QuoteEnquiry.artist_id == await booking_service.approved_artist_id(self.session, user)

    async def artist_list(self, user: User, view: ArtistView | None, limit: int, cursor: str | None):
        theirs = await self._theirs(user)
        await self.expire_lapsed(theirs)
        where = [theirs] if view is None else [theirs, ARTIST_VIEWS[view]]
        return await self.page(where, limit, cursor)

    async def artist_get(self, user: User, enquiry_id: uuid.UUID) -> dict[str, Any]:
        return await self.get(enquiry_id, await self._theirs(user))

    async def summary(self, user: User) -> dict[str, int]:
        theirs = await self._theirs(user)
        await self.expire_lapsed(theirs)
        counts = await self.enquiries.count_by_status(theirs, QuoteEnquiry.status.in_(LIVE))
        return {"open": counts.get(EnquiryStatus.open, 0), "quoted": counts.get(EnquiryStatus.quoted, 0)}

    async def quote(self, user: User, enquiry_id: uuid.UUID, data: QuoteIn) -> dict[str, Any]:
        """Quote, or replace the current quote; the customer is told each time."""
        theirs = await self._theirs(user)
        enquiry = await self.locked(enquiry_id, theirs)
        self.require_live(enquiry)
        if not self.today() <= data.valid_until <= enquiry.event_date:
            raise ValidationError("Pick a valid-until date between today and the event")
        enquiry.status = EnquiryStatus.quoted
        enquiry.quote_price_paise = data.price_paise
        enquiry.quote_duration_minutes = data.duration_minutes
        enquiry.quote_note = data.note
        enquiry.quote_valid_until_date = data.valid_until
        enquiry.quoted_at = self.clock.now()
        row = await self.enquiries.row(enquiry_id, theirs)
        await notices.quoted(self.session, enquiry, row.business_name if row else "Your artist")
        return await self.save(enquiry_id, theirs)

    async def decline(self, user: User, enquiry_id: uuid.UUID, reason: str | None) -> dict[str, Any]:
        theirs = await self._theirs(user)
        enquiry = await self.locked(enquiry_id, theirs)
        self.require_live(enquiry)
        enquiry.status = EnquiryStatus.declined
        enquiry.decline_reason = reason
        enquiry.closed_at = self.clock.now()
        row = await self.enquiries.row(enquiry_id, theirs)
        await notices.declined(self.session, enquiry, row.business_name if row else "The artist")
        return await self.save(enquiry_id, theirs)
