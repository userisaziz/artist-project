from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.review.service import ReviewService
from app.shared.clock import Clock, get_clock


def get_review_service(
    session: AsyncSession = Depends(get_db, scope="function"), clock: Clock = Depends(get_clock)
) -> ReviewService:
    return ReviewService(session, clock)
