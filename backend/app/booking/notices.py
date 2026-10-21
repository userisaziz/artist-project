"""What a booking change tells the other side (inbox + push)."""

import uuid
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.booking.models import Booking
from app.booking.rules import IST
from app.notification import service as notification_service
from app.notification.constants import Kind


def when_at(moment: datetime) -> str:
    return moment.astimezone(IST).strftime("%a %d %b, %I:%M %p").replace(" 0", " ")


def when(b: Booking) -> str:
    return when_at(b.start_at)


async def requested(session: AsyncSession, b: Booking, artist_user: uuid.UUID) -> None:
    await notification_service.notify(
        session,
        artist_user,
        "booking_requested",
        "New booking request",
        f"{b.service_name} on {when(b)}",
        f"/artist/booking/{b.id}",
    )


async def answered(session: AsyncSession, b: Booking, accepted: bool) -> None:
    title = "Booking confirmed" if accepted else "Booking declined"
    body = f"{b.service_name} on {when(b)}" + ("" if accepted else ". Pick another artist or time.")
    kind: Kind = "booking_accepted" if accepted else "booking_declined"
    await notification_service.notify(session, b.customer_id, kind, title, body, f"/customer/booking/{b.id}")


async def cancelled(session: AsyncSession, b: Booking, by: str) -> None:
    body = f"{b.service_name} on {when(b)} was cancelled"
    if by != "customer":
        await notification_service.notify(
            session, b.customer_id, "booking_cancelled", "Booking cancelled", body, f"/customer/booking/{b.id}"
        )
    if by != "artist":
        await notification_service.notify_artist(
            session, b.artist_id, "booking_cancelled", "Booking cancelled", body, f"/artist/booking/{b.id}"
        )


async def reschedule_requested(session: AsyncSession, b: Booking, new_start: datetime) -> None:
    await notification_service.notify_artist(
        session,
        b.artist_id,
        "reschedule_requested",
        "Asked to move a booking",
        f"{b.service_name} from {when(b)} to {when_at(new_start)}",
        f"/artist/booking/{b.id}",
    )


async def reschedule_answered(session: AsyncSession, b: Booking, accepted: bool) -> None:
    """Sent after the answer is applied: on accept `b` already carries the new time."""
    title = "Booking moved" if accepted else "Time change declined"
    body = f"{b.service_name} is now on {when(b)}" if accepted else f"{b.service_name} stays on {when(b)}"
    kind: Kind = "reschedule_accepted" if accepted else "reschedule_declined"
    await notification_service.notify(session, b.customer_id, kind, title, body, f"/customer/booking/{b.id}")
