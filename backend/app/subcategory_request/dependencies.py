from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.shared.clock import Clock, get_clock
from app.subcategory_request.service import SubcategoryRequestService


def get_subcategory_request_service(
    session: AsyncSession = Depends(get_db, scope="function"), clock: Clock = Depends(get_clock)
) -> SubcategoryRequestService:
    return SubcategoryRequestService(session, clock)
