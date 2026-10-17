import uuid

from fastapi import APIRouter, Depends, Query

from app.core.auth import current_admin
from app.review.schemas import AdminReviewOut, AdminReviewPage, DecisionIn
from app.review.service import ReviewService, get_review_service
from app.shared.enums import ReviewStatus
from app.user.models import User

router = APIRouter(prefix="/admin/reviews", tags=["admin"])


@router.get("", response_model=AdminReviewPage)
async def list_reviews(
    status: ReviewStatus | None = None,
    limit: int = Query(20, ge=1, le=100),
    cursor: str | None = None,
    _: User = Depends(current_admin),
    reviews: ReviewService = Depends(get_review_service),
) -> AdminReviewPage:
    items, next_cursor = await reviews.admin_list(status, limit, cursor)
    return AdminReviewPage(items=items, next_cursor=next_cursor)


@router.post("/{review_id}/decision", response_model=AdminReviewOut)
async def decide_review(
    review_id: uuid.UUID,
    body: DecisionIn,
    admin: User = Depends(current_admin),
    reviews: ReviewService = Depends(get_review_service),
) -> AdminReviewOut:
    return await reviews.decide(admin, review_id, body.decision, body.note)
