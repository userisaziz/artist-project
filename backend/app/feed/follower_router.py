from fastapi import APIRouter, Depends, Query

from app.core.auth import current_artist
from app.feed.dependencies import get_feed_service
from app.feed.schemas import FollowerPage
from app.feed.service import FeedService
from app.shared.responses import errors
from app.user.models import User

# The signed-in, approved artist's followers (customers who follow them from the feed).
router = APIRouter(prefix="/artists/me/followers", tags=["artist posts"], responses=errors(401, 403, 404, 409, 422))


@router.get("", response_model=FollowerPage, status_code=200, summary="Who follows me, newest first")
async def list_my_followers(
    limit: int = Query(20, ge=1, le=100),
    cursor: str | None = None,
    user: User = Depends(current_artist),
    feed: FeedService = Depends(get_feed_service),
) -> dict:
    return await feed.followers(user, limit, cursor)
