import uuid

from fastapi import APIRouter, Depends, Query

from app.artist.schemas import RejectIn
from app.booking.admin_service import AdminBookingService
from app.booking.constants import OverviewPeriod
from app.booking.dependencies import get_admin_booking_service
from app.booking.schemas import AdminBookingOut, AdminBookingPage, AdminOverview
from app.core.auth import audited_admin
from app.shared.enums import BookingStatus
from app.shared.responses import errors

router = APIRouter(
    prefix="/admin", tags=["admin"], dependencies=[Depends(audited_admin)], responses=errors(401, 403, 404, 409, 422)
)


@router.get("/bookings", response_model=AdminBookingPage, status_code=200, summary="Search all bookings")
async def list_bookings(
    status: BookingStatus | None = None,
    q: str | None = Query(None, max_length=100),
    limit: int = Query(20, ge=1, le=100),
    cursor: str | None = None,
    bookings: AdminBookingService = Depends(get_admin_booking_service),
) -> dict:
    items, next_cursor = await bookings.list(status, q, limit, cursor)
    return {"items": items, "next_cursor": next_cursor}


@router.get("/bookings/{booking_id}", response_model=AdminBookingOut, summary="Any booking", status_code=200)
async def get_booking(
    booking_id: uuid.UUID, bookings: AdminBookingService = Depends(get_admin_booking_service)
) -> dict:
    return await bookings.get(booking_id)


@router.post(
    "/bookings/{booking_id}/cancel",
    response_model=AdminBookingOut,
    summary="Cancel a booking (deposit refunded)",
    status_code=200,
)
async def cancel_booking(
    booking_id: uuid.UUID, body: RejectIn, bookings: AdminBookingService = Depends(get_admin_booking_service)
) -> dict:
    return await bookings.cancel(booking_id, body.reason)


@router.get("/overview", response_model=AdminOverview, summary="Overview KPIs", status_code=200)
async def overview(
    period: OverviewPeriod = OverviewPeriod.last_30_days,
    city: str | None = Query(None, min_length=1, max_length=60),
    bookings: AdminBookingService = Depends(get_admin_booking_service),
) -> dict:
    return await bookings.overview(period, city)
