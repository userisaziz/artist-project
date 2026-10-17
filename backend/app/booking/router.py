import uuid
from typing import Literal

from fastapi import APIRouter, Depends, Query

from app.booking.schemas import BookingIn, BookingOut, BookingPage, ReasonIn
from app.booking.service import BookingService, get_booking_service
from app.core.auth import current_customer
from app.review.schemas import OwnReviewOut, ReviewIn
from app.review.service import ReviewService, get_review_service
from app.user.models import User

# A customer's own bookings. Someone else's booking reads as 404, never 403, so ids can't be probed.
router = APIRouter(prefix="/bookings", tags=["bookings"])


@router.post("", response_model=BookingOut, status_code=201)
async def request_booking(
    body: BookingIn, user: User = Depends(current_customer), bookings: BookingService = Depends(get_booking_service)
) -> BookingOut:
    return await bookings.create(user, body)


@router.get("", response_model=BookingPage)
async def list_my_bookings(
    scope: Literal["upcoming", "past"] = "upcoming",
    limit: int = Query(20, ge=1, le=100),
    cursor: str | None = None,
    user: User = Depends(current_customer),
    bookings: BookingService = Depends(get_booking_service),
) -> BookingPage:
    items, next_cursor = await bookings.customer_list(user, scope, limit, cursor)
    return BookingPage(items=items, next_cursor=next_cursor)


@router.get("/{booking_id}", response_model=BookingOut)
async def get_my_booking(
    booking_id: uuid.UUID,
    user: User = Depends(current_customer),
    bookings: BookingService = Depends(get_booking_service),
) -> BookingOut:
    return await bookings.customer_get(user, booking_id)


@router.post("/{booking_id}/cancel", response_model=BookingOut)
async def cancel_my_booking(
    booking_id: uuid.UUID,
    body: ReasonIn,
    user: User = Depends(current_customer),
    bookings: BookingService = Depends(get_booking_service),
) -> BookingOut:
    return await bookings.customer_cancel(user, booking_id, body.reason)


@router.post("/{booking_id}/review", response_model=OwnReviewOut, status_code=201)
async def review_my_booking(
    booking_id: uuid.UUID,
    body: ReviewIn,
    user: User = Depends(current_customer),
    reviews: ReviewService = Depends(get_review_service),
) -> OwnReviewOut:
    return await reviews.create(user, booking_id, body)
