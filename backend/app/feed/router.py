import uuid

from fastapi import APIRouter, Depends, Query

from app.core.auth import current_customer
from app.feed.constants import FeedTab
from app.feed.dependencies import get_feed_service, limit_reactions
from app.feed.schemas import FollowOut, LikeOut, PostOut, PostPage
from app.feed.service import FeedService
from app.shared.responses import errors
from app.user.models import User

# The customer feed. Posts of artists who aren't approved (any more) read as 404.
router = APIRouter(prefix="/feed", tags=["feed"], responses=errors(401, 403, 404, 422, 429))


@router.get("", response_model=PostPage, status_code=200, summary="The feed, newest first")
async def read_feed(
    tab: FeedTab = "for_you",
    limit: int = Query(20, ge=1, le=50),
    cursor: str | None = None,
    user: User = Depends(current_customer),
    feed: FeedService = Depends(get_feed_service),
) -> dict:
    items, next_cursor = await feed.feed(user, tab, limit, cursor)
    return {"items": items, "next_cursor": next_cursor}


@router.get("/posts/{post_id}", response_model=PostOut, status_code=200, summary="One post, with an article's body")
async def read_post(
    post_id: uuid.UUID, user: User = Depends(current_customer), feed: FeedService = Depends(get_feed_service)
) -> dict:
    return await feed.detail(user, post_id)


@router.put(
    "/posts/{post_id}/like",
    response_model=LikeOut,
    status_code=200,
    summary="Like a post",
    dependencies=[Depends(limit_reactions)],
)
async def like_post(
    post_id: uuid.UUID, user: User = Depends(current_customer), feed: FeedService = Depends(get_feed_service)
) -> dict:
    return await feed.set_like(user, post_id, liked=True)


@router.delete(
    "/posts/{post_id}/like",
    response_model=LikeOut,
    status_code=200,
    summary="Take back a like",
    dependencies=[Depends(limit_reactions)],
)
async def unlike_post(
    post_id: uuid.UUID, user: User = Depends(current_customer), feed: FeedService = Depends(get_feed_service)
) -> dict:
    return await feed.set_like(user, post_id, liked=False)


@router.put(
    "/artists/{artist_id}/follow",
    response_model=FollowOut,
    status_code=200,
    summary="Follow an artist",
    dependencies=[Depends(limit_reactions)],
)
async def follow_artist(
    artist_id: uuid.UUID, user: User = Depends(current_customer), feed: FeedService = Depends(get_feed_service)
) -> dict:
    return await feed.set_follow(user, artist_id, following=True)


@router.delete(
    "/artists/{artist_id}/follow",
    response_model=FollowOut,
    status_code=200,
    summary="Unfollow an artist",
    dependencies=[Depends(limit_reactions)],
)
async def unfollow_artist(
    artist_id: uuid.UUID, user: User = Depends(current_customer), feed: FeedService = Depends(get_feed_service)
) -> dict:
    return await feed.set_follow(user, artist_id, following=False)
