import uuid

from fastapi import APIRouter, Depends, Query

from app.core.auth import current_artist
from app.review.schemas import OwnReviewOut, OwnReviewPage, ReplyIn, ReportIn
from app.review.service import ReviewService, get_review_service
from app.user.models import User

# An approved artist's reviews: read all but removed ones, reply once (editable), report one.
router = APIRouter(prefix="/artists/me/reviews", tags=["artist reviews"])


@router.get("", response_model=OwnReviewPage)
async def list_my_reviews(
    limit: int = Query(20, ge=1, le=100),
    cursor: str | None = None,
    user: User = Depends(current_artist),
    reviews: ReviewService = Depends(get_review_service),
) -> OwnReviewPage:
    items, next_cursor, summary = await reviews.artist_list(user, limit, cursor)
    return OwnReviewPage(items=items, next_cursor=next_cursor, summary=summary)


@router.put("/{review_id}/reply", response_model=OwnReviewOut)
async def reply_to_review(
    review_id: uuid.UUID,
    body: ReplyIn,
    user: User = Depends(current_artist),
    reviews: ReviewService = Depends(get_review_service),
) -> OwnReviewOut:
    return await reviews.reply(user, review_id, body.text)


@router.post("/{review_id}/report", response_model=OwnReviewOut)
async def report_review(
    review_id: uuid.UUID,
    body: ReportIn,
    user: User = Depends(current_artist),
    reviews: ReviewService = Depends(get_review_service),
) -> OwnReviewOut:
    return await reviews.report(user, review_id, body.reason)
