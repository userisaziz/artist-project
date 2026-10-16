import uuid
from typing import Literal

from fastapi import APIRouter, Depends, Query

from app.core.dependencies import current_admin, get_custom_service_review
from app.schemas.artist import AdminCustomServiceOut, AdminCustomServicePage, RejectIn
from app.services.custom_service_review import CustomServiceReview
from app.utils.enums import ArtistServiceStatus

router = APIRouter(prefix="/admin/custom-services", tags=["admin"], dependencies=[Depends(current_admin)])


@router.get("", response_model=AdminCustomServicePage)
async def list_custom_services(
    status: Literal["pending", "approved", "rejected"] = "pending",
    limit: int = Query(20, ge=1, le=100),
    cursor: str | None = None,
    review: CustomServiceReview = Depends(get_custom_service_review),
) -> AdminCustomServicePage:
    items, next_cursor = await review.list(ArtistServiceStatus(status), limit, cursor)
    return AdminCustomServicePage(items=items, next_cursor=next_cursor)


@router.post("/{service_id}/approve", response_model=AdminCustomServiceOut)
async def approve_custom_service(
    service_id: uuid.UUID, review: CustomServiceReview = Depends(get_custom_service_review)
) -> AdminCustomServiceOut:
    return await review.approve(service_id)


@router.post("/{service_id}/reject", response_model=AdminCustomServiceOut)
async def reject_custom_service(
    service_id: uuid.UUID, body: RejectIn, review: CustomServiceReview = Depends(get_custom_service_review)
) -> AdminCustomServiceOut:
    return await review.reject(service_id, body.reason)
