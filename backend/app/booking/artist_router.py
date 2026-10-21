import uuid
from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, Query

from app.booking.dependencies import get_booking_service
from app.booking.schemas import ArtistDashboard, BookingOut, BookingPage, ReasonIn
from app.booking.service import BookingService
from app.core.auth import current_artist
from app.shared.responses import errors
from app.user.models import User

# An approved artist's requests and schedule. Draft, pending or rejected profiles get 409.
router = APIRouter(prefix="/artists/me", tags=["artist bookings"], responses=errors(401, 403, 404, 409, 422))


@router.get("/bookings", response_model=BookingPage, status_code=200, summary="My requests, upcoming and past bookings")
async def list_artist_bookings(
    scope: Literal["requests", "upcoming", "past"] | None = None,
    from_: date | None = Query(None, alias="from", description="IST date, inclusive"),
    to: date | None = Query(None, description="IST date, inclusive"),
    limit: int = Query(20, ge=1, le=200),
    cursor: str | None = None,
    user: User = Depends(current_artist),
    bookings: BookingService = Depends(get_booking_service),
) -> dict:
    items, next_cursor = await bookings.artist_list(user, scope, from_, to, limit, cursor)
    return {"items": items, "next_cursor": next_cursor}


@router.get("/bookings/{booking_id}", response_model=BookingOut, status_code=200, summary="One of my bookings")
async def get_artist_booking(
    booking_id: uuid.UUID, user: User = Depends(current_artist), bookings: BookingService = Depends(get_booking_service)
) -> dict:
    return await bookings.artist_get(user, booking_id)


@router.post(
    "/bookings/{booking_id}/accept", response_model=BookingOut, summary="Accept a booking request", status_code=200
)
async def accept_booking(
    booking_id: uuid.UUID, user: User = Depends(current_artist), bookings: BookingService = Depends(get_booking_service)
) -> dict:
    return await bookings.accept(user, booking_id)


@router.post(
    "/bookings/{booking_id}/decline", response_model=BookingOut, summary="Decline a booking request", status_code=200
)
async def decline_booking(
    booking_id: uuid.UUID,
    body: ReasonIn,
    user: User = Depends(current_artist),
    bookings: BookingService = Depends(get_booking_service),
) -> dict:
    return await bookings.decline(user, booking_id, body.reason)


@router.post(
    "/bookings/{booking_id}/complete", response_model=BookingOut, summary="Mark a booking completed", status_code=200
)
async def complete_booking(
    booking_id: uuid.UUID, user: User = Depends(current_artist), bookings: BookingService = Depends(get_booking_service)
) -> dict:
    return await bookings.complete(user, booking_id)


@router.get(
    "/dashboard",
    response_model=ArtistDashboard,
    summary="Dashboard counts, earnings and today's schedule",
    status_code=200,
)
async def artist_dashboard(
    user: User = Depends(current_artist), bookings: BookingService = Depends(get_booking_service)
) -> dict:
    return await bookings.dashboard(user)
