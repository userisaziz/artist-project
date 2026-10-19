from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.booking.config import BookingSettings, get_booking_settings
from app.catalog.config import CatalogSettings, get_catalog_settings
from app.core.database import get_db
from app.platform.service import PlatformService
from app.shared.clock import Clock, get_clock


def get_platform_service(
    session: AsyncSession = Depends(get_db, scope="function"),
    booking: BookingSettings = Depends(get_booking_settings),
    catalog: CatalogSettings = Depends(get_catalog_settings),
    clock: Clock = Depends(get_clock),
) -> PlatformService:
    return PlatformService(session, booking, catalog, clock)
