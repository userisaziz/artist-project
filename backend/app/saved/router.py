import uuid

from fastapi import APIRouter, Depends, Query, Response

from app.core.auth import current_customer
from app.directory.schemas import ArtistCardPage
from app.feed.schemas import PostPage
from app.saved.constants import SavedKind
from app.saved.dependencies import get_saved_service, limit_saves
from app.saved.schemas import SavedIds
from app.saved.service import SavedService
from app.shared.responses import errors
from app.shop.schemas import ProductPage
from app.user.models import User

# A customer's bookmarks. Lists hold only what customers can see right now; ids hold everything saved.
router = APIRouter(prefix="/saved", tags=["saved"], responses=errors(401, 403, 404, 422, 429))


@router.put(
    "/{kind}/{target_id}",
    status_code=204,
    response_class=Response,
    summary="Save a post, artist or product",
    dependencies=[Depends(limit_saves)],
)
async def save_item(
    kind: SavedKind,
    target_id: uuid.UUID,
    user: User = Depends(current_customer),
    saved: SavedService = Depends(get_saved_service),
) -> None:
    await saved.save(user, kind, target_id)


@router.delete("/{kind}/{target_id}", status_code=204, response_class=Response, summary="Unsave (idempotent)")
async def unsave_item(
    kind: SavedKind,
    target_id: uuid.UUID,
    user: User = Depends(current_customer),
    saved: SavedService = Depends(get_saved_service),
) -> None:
    await saved.unsave(user, kind, target_id)


@router.get("/ids", response_model=SavedIds, status_code=200, summary="Every saved id, by kind")
async def read_saved_ids(
    user: User = Depends(current_customer), saved: SavedService = Depends(get_saved_service)
) -> dict:
    return await saved.ids(user)


@router.get("/posts", response_model=PostPage, status_code=200, summary="Saved posts, newest saved first")
async def list_saved_posts(
    limit: int = Query(20, ge=1, le=50),
    cursor: str | None = None,
    user: User = Depends(current_customer),
    saved: SavedService = Depends(get_saved_service),
) -> dict:
    items, next_cursor = await saved.page(user, SavedKind.post, limit, cursor)
    return {"items": items, "next_cursor": next_cursor}


@router.get("/artists", response_model=ArtistCardPage, status_code=200, summary="Saved artists, newest saved first")
async def list_saved_artists(
    limit: int = Query(20, ge=1, le=50),
    cursor: str | None = None,
    user: User = Depends(current_customer),
    saved: SavedService = Depends(get_saved_service),
) -> dict:
    items, next_cursor = await saved.page(user, SavedKind.artist, limit, cursor)
    return {"items": items, "next_cursor": next_cursor}


@router.get("/products", response_model=ProductPage, status_code=200, summary="Saved products, newest saved first")
async def list_saved_products(
    limit: int = Query(20, ge=1, le=50),
    cursor: str | None = None,
    user: User = Depends(current_customer),
    saved: SavedService = Depends(get_saved_service),
) -> dict:
    items, next_cursor = await saved.page(user, SavedKind.product, limit, cursor)
    return {"items": items, "next_cursor": next_cursor}
