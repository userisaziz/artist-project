from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.booking import constants
from app.booking.admin_service import AdminBookingService
from app.booking.config import BookingSettings, get_booking_settings
from app.booking.service import BookingService
from app.core.database import get_db
from app.core.rate_limit import Limit, limit_by_user
from app.shared.clock import Clock, get_clock
from app.upload.service import ImageStorage, get_storage


def get_booking_service(
    session: AsyncSession = Depends(get_db, scope="function"),
    storage: ImageStorage = Depends(get_storage),
    settings: BookingSettings = Depends(get_booking_settings),
    clock: Clock = Depends(get_clock),
) -> BookingService:
    return BookingService(session, storage, settings, clock)


def get_admin_booking_service(
    session: AsyncSession = Depends(get_db, scope="function"),
    storage: ImageStorage = Depends(get_storage),
    settings: BookingSettings = Depends(get_booking_settings),
    clock: Clock = Depends(get_clock),
) -> AdminBookingService:
    return AdminBookingService(session, storage, settings, clock)


def booking_requests_per_user() -> Limit:
    return constants.BOOKING_REQUESTS_PER_USER


def reviews_per_user() -> Limit:
    return constants.REVIEWS_PER_USER


def reschedule_requests_per_user() -> Limit:
    return constants.RESCHEDULE_REQUESTS_PER_USER


limit_booking_requests = limit_by_user("booking_request", booking_requests_per_user)
limit_reviews = limit_by_user("review", reviews_per_user)
limit_reschedule_requests = limit_by_user("reschedule_request", reschedule_requests_per_user)
