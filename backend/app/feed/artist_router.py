import uuid

from fastapi import APIRouter, Depends, Query, Response

from app.core.auth import current_artist
from app.feed.dependencies import get_feed_service, limit_posts
from app.feed.schemas import PostIn, PostOut, PostPage
from app.feed.service import FeedService
from app.shared.responses import errors
from app.user.models import User

# An approved artist's own posts. Draft, pending or rejected profiles get 409.
router = APIRouter(prefix="/artists/me/posts", tags=["artist posts"], responses=errors(401, 403, 404, 409, 422, 429))


@router.post(
    "",
    response_model=PostOut,
    status_code=201,
    summary="Publish a photo post or an article",
    dependencies=[Depends(limit_posts)],
)
async def create_post(
    body: PostIn, user: User = Depends(current_artist), feed: FeedService = Depends(get_feed_service)
) -> dict:
    return await feed.create(user, body)


@router.get("", response_model=PostPage, status_code=200, summary="My posts, newest first")
async def list_my_posts(
    limit: int = Query(20, ge=1, le=100),
    cursor: str | None = None,
    user: User = Depends(current_artist),
    feed: FeedService = Depends(get_feed_service),
) -> dict:
    items, next_cursor = await feed.mine(user, limit, cursor)
    return {"items": items, "next_cursor": next_cursor}


@router.delete("/{post_id}", status_code=204, summary="Delete one of my posts", response_class=Response)
async def delete_post(
    post_id: uuid.UUID, user: User = Depends(current_artist), feed: FeedService = Depends(get_feed_service)
) -> None:
    await feed.delete(user, post_id)
