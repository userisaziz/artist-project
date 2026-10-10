import uuid
from typing import Literal

from fastapi import APIRouter, Depends, Query

from app.core.dependencies import current_admin, get_admin_artist_service
from app.models.artist import ArtistProfile
from app.models.user import User
from app.schemas.artist import (
    AdminArtistDetail,
    AdminArtistPage,
    ArtistOwner,
    RejectIn,
    profile_out,
    summary_out,
)
from app.services.admin_artist_service import AdminArtistService
from app.services.storage import ImageStorage, get_storage
from app.utils.enums import ArtistStatus

router = APIRouter(prefix="/admin/artists", tags=["admin"])


def _detail(profile: ArtistProfile, owner: User, storage: ImageStorage) -> AdminArtistDetail:
    return AdminArtistDetail(**profile_out(profile, storage).model_dump(), owner=ArtistOwner.model_validate(owner))


@router.get("", response_model=AdminArtistPage)
async def list_artists(
    status: Literal["pending", "approved", "rejected"] = "pending",
    limit: int = Query(20, ge=1, le=100),
    cursor: str | None = None,
    _: User = Depends(current_admin),
    service: AdminArtistService = Depends(get_admin_artist_service),
    storage: ImageStorage = Depends(get_storage),
) -> AdminArtistPage:
    items, next_cursor = await service.list(ArtistStatus(status), limit, cursor)
    return AdminArtistPage(items=[summary_out(p, storage) for p in items], next_cursor=next_cursor)


@router.get("/{artist_id}", response_model=AdminArtistDetail)
async def get_artist(
    artist_id: uuid.UUID,
    _: User = Depends(current_admin),
    service: AdminArtistService = Depends(get_admin_artist_service),
    storage: ImageStorage = Depends(get_storage),
) -> AdminArtistDetail:
    return _detail(*await service.get(artist_id), storage)


@router.post("/{artist_id}/approve", response_model=AdminArtistDetail)
async def approve_artist(
    artist_id: uuid.UUID,
    admin: User = Depends(current_admin),
    service: AdminArtistService = Depends(get_admin_artist_service),
    storage: ImageStorage = Depends(get_storage),
) -> AdminArtistDetail:
    return _detail(*await service.approve(admin, artist_id), storage)


@router.post("/{artist_id}/reject", response_model=AdminArtistDetail)
async def reject_artist(
    artist_id: uuid.UUID,
    body: RejectIn,
    admin: User = Depends(current_admin),
    service: AdminArtistService = Depends(get_admin_artist_service),
    storage: ImageStorage = Depends(get_storage),
) -> AdminArtistDetail:
    return _detail(*await service.reject(admin, artist_id, body.reason), storage)
