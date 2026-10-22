from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.requirement.service import RequirementService
from app.shared.clock import Clock, get_clock


def get_requirement_service(
    session: AsyncSession = Depends(get_db, scope="function"), clock: Clock = Depends(get_clock)
) -> RequirementService:
    return RequirementService(session, clock)
