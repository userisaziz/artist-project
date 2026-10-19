import uuid

from fastapi import APIRouter, Depends, Query

from app.artist.schemas import RejectIn
from app.core.auth import audited_admin
from app.shared.responses import errors
from app.subcategory_request.constants import REQUESTS_PER_PAGE, SubcategoryRequestStatus
from app.subcategory_request.dependencies import get_subcategory_request_service
from app.subcategory_request.schemas import (
    ApproveIn,
    SubcategoryRequestOut,
    SubcategoryRequestPage,
    SubcategoryRequestSummary,
)
from app.subcategory_request.service import SubcategoryRequestService
from app.user.models import User

router = APIRouter(
    prefix="/admin/subcategory-requests",
    tags=["admin"],
    dependencies=[Depends(audited_admin)],
    responses=errors(401, 403, 404, 409, 422),
)


@router.get("", response_model=SubcategoryRequestPage, status_code=200, summary="Subcategories artists suggested")
async def list_requests(
    status: SubcategoryRequestStatus = SubcategoryRequestStatus.pending,
    limit: int = Query(REQUESTS_PER_PAGE, ge=1, le=100),
    cursor: str | None = None,
    requests: SubcategoryRequestService = Depends(get_subcategory_request_service),
) -> dict:
    items, next_cursor = await requests.list(status, limit, cursor)
    return {"items": items, "next_cursor": next_cursor}


@router.get("/summary", response_model=SubcategoryRequestSummary, status_code=200, summary="Counts and KPIs")
async def request_summary(requests: SubcategoryRequestService = Depends(get_subcategory_request_service)) -> dict:
    return await requests.summary()


@router.post(
    "/{request_id}/approve",
    response_model=SubcategoryRequestOut,
    status_code=200,
    summary="Add it to the catalog (optionally renamed)",
)
async def approve_request(
    request_id: uuid.UUID,
    body: ApproveIn,
    admin: User = Depends(audited_admin),
    requests: SubcategoryRequestService = Depends(get_subcategory_request_service),
) -> dict:
    return await requests.approve(request_id, body.name, admin.id)


@router.post("/{request_id}/reject", response_model=SubcategoryRequestOut, status_code=200, summary="Turn it down")
async def reject_request(
    request_id: uuid.UUID,
    body: RejectIn,
    admin: User = Depends(audited_admin),
    requests: SubcategoryRequestService = Depends(get_subcategory_request_service),
) -> dict:
    return await requests.reject(request_id, body.reason, admin.id)
