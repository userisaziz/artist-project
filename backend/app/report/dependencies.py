from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.report.service import ReportService
from app.shared.clock import Clock, get_clock


def get_report_service(
    session: AsyncSession = Depends(get_db, scope="function"), clock: Clock = Depends(get_clock)
) -> ReportService:
    return ReportService(session, clock)
