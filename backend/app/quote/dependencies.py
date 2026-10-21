from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.booking.config import BookingSettings, get_booking_settings
from app.core.database import get_db
from app.core.rate_limit import Limit, limit_by_user
from app.quote import constants
from app.quote.config import QuoteSettings, get_quote_settings
from app.quote.service import QuoteService
from app.shared.clock import Clock, get_clock
from app.upload.service import ImageStorage, get_storage


def get_quote_service(
    session: AsyncSession = Depends(get_db, scope="function"),
    storage: ImageStorage = Depends(get_storage),
    settings: QuoteSettings = Depends(get_quote_settings),
    booking_settings: BookingSettings = Depends(get_booking_settings),
    clock: Clock = Depends(get_clock),
) -> QuoteService:
    return QuoteService(session, storage, settings, booking_settings, clock)


def enquiries_per_user() -> Limit:
    return constants.ENQUIRIES_PER_USER


limit_enquiries = limit_by_user("enquiry", enquiries_per_user)
