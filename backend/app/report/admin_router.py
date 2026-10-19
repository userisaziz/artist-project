from fastapi import APIRouter, Depends, Path, Response

from app.core.auth import audited_admin
from app.report.constants import Period
from app.report.dependencies import get_report_service
from app.report.schemas import ReportSummary
from app.report.service import ReportService
from app.shared.responses import errors

router = APIRouter(
    prefix="/admin/reports",
    tags=["admin reports"],
    dependencies=[Depends(audited_admin)],
    responses=errors(401, 403, 404, 422),
)


@router.get("/summary", response_model=ReportSummary, status_code=200, summary="Booking figures for a period")
async def report_summary(period: Period = "30d", reports: ReportService = Depends(get_report_service)) -> dict:
    return await reports.summary(period)


@router.get(
    "/{report}.csv",
    response_model=str,  # documented as text; the handler returns the CSV Response as is
    status_code=200,
    summary="Download a report as CSV",
    response_class=Response,
    responses={200: {"content": {"text/csv": {}}}},
)
async def download_report(
    report: str = Path(max_length=40),
    period: Period = "30d",
    reports: ReportService = Depends(get_report_service),
) -> Response:
    return Response(
        await reports.export(report, period),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{report}-{period}.csv"', "Cache-Control": "no-store"},
    )
