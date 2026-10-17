import uuid

from fastapi import APIRouter, Depends, Query

from app.core.dependencies import current_admin, get_review_service
from app.models.user import User
from app.schemas.review import AdminReviewOut, AdminReviewPage, DecisionIn
from app.services.review_service import ReviewService
from app.utils.enums import ReviewStatus

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
    review_id: uuid.UUID, body: DecisionIn, admin: User = Depends(current_admin),
    reviews: ReviewService = Depends(get_review_service),
) -> AdminReviewOut:
    return await reviews.decide(admin, review_id, body.decision, body.note)
