import uuid

from fastapi import APIRouter, Depends, Query

from app.core.auth import current_artist
from app.review.dependencies import get_review_service
from app.review.schemas import OwnReviewOut, OwnReviewPage, ReplyIn, ReportIn
from app.review.service import ReviewService
from app.shared.responses import errors
from app.user.models import User

# An approved artist's reviews: read all but removed ones, reply once (editable), report one.
router = APIRouter(prefix="/artists/me/reviews", tags=["artist reviews"], responses=errors(401, 403, 404, 409, 422))


@router.get("", response_model=OwnReviewPage, status_code=200, summary="Reviews of my work")
async def list_my_reviews(
    limit: int = Query(20, ge=1, le=100),
    cursor: str | None = None,
    user: User = Depends(current_artist),
    reviews: ReviewService = Depends(get_review_service),
) -> dict:
    items, next_cursor, summary = await reviews.artist_list(user, limit, cursor)
    return {"items": items, "next_cursor": next_cursor, "summary": summary}


@router.put("/{review_id}/reply", response_model=OwnReviewOut, summary="Reply to a review", status_code=200)
async def reply_to_review(
    review_id: uuid.UUID,
    body: ReplyIn,
    user: User = Depends(current_artist),
    reviews: ReviewService = Depends(get_review_service),
) -> dict:
    return await reviews.reply(user, review_id, body.text)


@router.post(
    "/{review_id}/report", response_model=OwnReviewOut, summary="Report a review to moderators", status_code=200
)
async def report_review(
    review_id: uuid.UUID,
    body: ReportIn,
    user: User = Depends(current_artist),
    reviews: ReviewService = Depends(get_review_service),
) -> dict:
    return await reviews.report(user, review_id, body.reason)
