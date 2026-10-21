"""What an enquiry change tells the other side (inbox + push)."""

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.notification import service as notification_service
from app.quote.models import QuoteEnquiry


def _day(e: QuoteEnquiry) -> str:
    return e.event_date.strftime("%a %d %b").replace(" 0", " ")


def _rupees(paise: int) -> str:
    return f"₹{paise // 100:,}" + (f".{paise % 100:02d}" if paise % 100 else "")


async def received(session: AsyncSession, e: QuoteEnquiry, artist_user: uuid.UUID) -> None:
    await notification_service.notify(
        session,
        artist_user,
        "enquiry_received",
        "New enquiry",
        f"For {_day(e)}: {e.details}",
        f"/artist/enquiries/{e.id}",
    )


async def quoted(session: AsyncSession, e: QuoteEnquiry, business_name: str) -> None:
    price = _rupees(e.quote_price_paise or 0)
    await notification_service.notify(
        session,
        e.customer_id,
        "quote_received",
        "You have a quote",
        f"{business_name} quoted {price} for {_day(e)}",
        f"/customer/enquiries/{e.id}",
    )


async def accepted(session: AsyncSession, e: QuoteEnquiry, artist_user: uuid.UUID, booking_id: uuid.UUID) -> None:
    await notification_service.notify(
        session,
        artist_user,
        "quote_accepted",
        "Quote accepted",
        f"Your quote for {_day(e)} is booked",
        f"/artist/booking/{booking_id}",
    )


async def declined(session: AsyncSession, e: QuoteEnquiry, business_name: str) -> None:
    await notification_service.notify(
        session,
        e.customer_id,
        "enquiry_declined",
        "Enquiry declined",
        f"{business_name} can't take your enquiry for {_day(e)}. Try another artist.",
        f"/customer/enquiries/{e.id}",
    )
