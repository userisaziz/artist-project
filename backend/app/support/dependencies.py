from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.rate_limit import Limit, limit_by_user
from app.shared.clock import Clock, get_clock
from app.support import constants
from app.support.service import SupportService


def get_support_service(
    session: AsyncSession = Depends(get_db, scope="function"), clock: Clock = Depends(get_clock)
) -> SupportService:
    return SupportService(session, clock)


def tickets_per_user() -> Limit:
    return constants.TICKETS_PER_USER


def messages_per_user() -> Limit:
    return constants.MESSAGES_PER_USER


limit_tickets = limit_by_user("support_ticket", tickets_per_user)
limit_messages = limit_by_user("support_message", messages_per_user)
