import uuid

from fastapi import APIRouter, Depends, Query

from app.core.auth import audited_admin
from app.feed.constants import AdminFeedView
from app.feed.dependencies import featured_slots, get_feed_service
from app.feed.schemas import AdminFeedSummary, AdminPostOut, AdminPostPage, ModerateIn
from app.feed.service import FeedService
from app.shared.responses import errors

router = APIRouter(
    prefix="/admin/feed",
    tags=["admin feed"],
    dependencies=[Depends(audited_admin)],
    responses=errors(401, 403, 404, 409, 422),
)


@router.get("/posts", response_model=AdminPostPage, status_code=200, summary="Every post, newest first")
async def list_posts(
    view: AdminFeedView = "all",
    limit: int = Query(20, ge=1, le=100),
    cursor: str | None = None,
    feed: FeedService = Depends(get_feed_service),
) -> dict:
    items, next_cursor = await feed.admin_list(view, limit, cursor)
    return {"items": items, "next_cursor": next_cursor}


@router.get("/summary", response_model=AdminFeedSummary, status_code=200, summary="Counts and featured slots")
async def feed_summary(slots: int = Depends(featured_slots), feed: FeedService = Depends(get_feed_service)) -> dict:
    return await feed.admin_summary(slots)


@router.post("/posts/{post_id}/moderate", response_model=AdminPostOut, status_code=200, summary="Keep, hide or remove")
async def moderate_post(post_id: uuid.UUID, body: ModerateIn, feed: FeedService = Depends(get_feed_service)) -> dict:
    return await feed.moderate(post_id, body.decision, body.note)


@router.post(
    "/posts/{post_id}/feature", response_model=AdminPostOut, status_code=200, summary="Feature at the top of For you"
)
async def feature_post(
    post_id: uuid.UUID, slots: int = Depends(featured_slots), feed: FeedService = Depends(get_feed_service)
) -> dict:
    return await feed.set_featured(post_id, True, slots)


@router.delete("/posts/{post_id}/feature", response_model=AdminPostOut, status_code=200, summary="Stop featuring")
async def unfeature_post(
    post_id: uuid.UUID, slots: int = Depends(featured_slots), feed: FeedService = Depends(get_feed_service)
) -> dict:
    return await feed.set_featured(post_id, False, slots)
