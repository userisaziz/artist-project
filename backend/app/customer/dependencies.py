from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.customer.service import AdminCustomerService
from app.shared.clock import Clock, get_clock


def get_admin_customer_service(
    session: AsyncSession = Depends(get_db, scope="function"), clock: Clock = Depends(get_clock)
) -> AdminCustomerService:
    return AdminCustomerService(session, clock)
