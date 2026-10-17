import uuid

from fastapi import APIRouter, Depends, Query

from app.artist.schemas import RejectIn
from app.core.auth import current_admin
from app.schemas.booking import AdminBookingOut, AdminBookingPage, AdminOverview
from app.services.admin_booking_service import (
    AdminBookingService,
    get_admin_booking_service,
)
from app.shared.enums import BookingStatus

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(current_admin)])


@router.get("/bookings", response_model=AdminBookingPage)
async def list_bookings(
    status: BookingStatus | None = None,
    q: str | None = Query(None, max_length=100),
    limit: int = Query(20, ge=1, le=100),
    cursor: str | None = None,
    bookings: AdminBookingService = Depends(get_admin_booking_service),
) -> AdminBookingPage:
    items, next_cursor = await bookings.list(status, q, limit, cursor)
    return AdminBookingPage(items=items, next_cursor=next_cursor)


@router.get("/bookings/{booking_id}", response_model=AdminBookingOut)
async def get_booking(
    booking_id: uuid.UUID, bookings: AdminBookingService = Depends(get_admin_booking_service)
) -> AdminBookingOut:
    return await bookings.get(booking_id)


@router.post("/bookings/{booking_id}/cancel", response_model=AdminBookingOut)
async def cancel_booking(
    booking_id: uuid.UUID, body: RejectIn, bookings: AdminBookingService = Depends(get_admin_booking_service)
) -> AdminBookingOut:
    return await bookings.cancel(booking_id, body.reason)


@router.get("/overview", response_model=AdminOverview)
async def overview(bookings: AdminBookingService = Depends(get_admin_booking_service)) -> AdminOverview:
    return await bookings.overview()
