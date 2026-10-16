import uuid
from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, Query

from app.core.dependencies import current_artist, get_booking_service
from app.models.user import User
from app.schemas.booking import ArtistDashboard, BookingOut, BookingPage, ReasonIn
from app.services.booking_service import BookingService

# An approved artist's requests and schedule. Draft, pending or rejected profiles get 409.
router = APIRouter(prefix="/artists/me", tags=["artist bookings"])


@router.get("/bookings", response_model=BookingPage)
async def list_artist_bookings(
    scope: Literal["requests", "upcoming", "past"] | None = None,
    from_: date | None = Query(None, alias="from", description="IST date, inclusive"),
    to: date | None = Query(None, description="IST date, inclusive"),
    limit: int = Query(20, ge=1, le=200),
    cursor: str | None = None,
    user: User = Depends(current_artist),
    bookings: BookingService = Depends(get_booking_service),
) -> BookingPage:
    items, next_cursor = await bookings.artist_list(user, scope, from_, to, limit, cursor)
    return BookingPage(items=items, next_cursor=next_cursor)


@router.post("/bookings/{booking_id}/accept", response_model=BookingOut)
async def accept_booking(
    booking_id: uuid.UUID, user: User = Depends(current_artist), bookings: BookingService = Depends(get_booking_service)
) -> BookingOut:
    return await bookings.accept(user, booking_id)


@router.post("/bookings/{booking_id}/decline", response_model=BookingOut)
async def decline_booking(
    booking_id: uuid.UUID, body: ReasonIn, user: User = Depends(current_artist),
    bookings: BookingService = Depends(get_booking_service),
) -> BookingOut:
    return await bookings.decline(user, booking_id, body.reason)


@router.post("/bookings/{booking_id}/complete", response_model=BookingOut)
async def complete_booking(
    booking_id: uuid.UUID, user: User = Depends(current_artist), bookings: BookingService = Depends(get_booking_service)
) -> BookingOut:
    return await bookings.complete(user, booking_id)


@router.get("/dashboard", response_model=ArtistDashboard)
async def artist_dashboard(
    user: User = Depends(current_artist), bookings: BookingService = Depends(get_booking_service)
) -> ArtistDashboard:
    return await bookings.dashboard(user)
