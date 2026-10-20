import uuid

from fastapi import APIRouter, Depends, Query

from app.core.auth import audited_admin
from app.review.dependencies import get_review_service
from app.review.schemas import AdminReviewOut, AdminReviewPage, DecisionIn
from app.review.service import ReviewService
from app.shared.enums import ReviewStatus
from app.shared.responses import errors
from app.user.models import User

router = APIRouter(
    prefix="/admin/reviews",
    tags=["admin"],
    dependencies=[Depends(audited_admin)],
    responses=errors(401, 403, 404, 409, 422),
)


@router.get("", response_model=AdminReviewPage, status_code=200, summary="Review moderation queue")
async def list_reviews(
    status: ReviewStatus | None = None,
    limit: int = Query(20, ge=1, le=100),
    cursor: str | None = None,
    reviews: ReviewService = Depends(get_review_service),
) -> dict:
    items, next_cursor = await reviews.admin_list(status, limit, cursor)
    return {"items": items, "next_cursor": next_cursor}


@router.post(
    "/{review_id}/decision", response_model=AdminReviewOut, summary="Publish, hide or remove a review", status_code=200
)
async def decide_review(
    review_id: uuid.UUID,
    body: DecisionIn,
    admin: User = Depends(audited_admin),
    reviews: ReviewService = Depends(get_review_service),
) -> dict:
    return await reviews.decide(admin, review_id, body.decision, body.note)
