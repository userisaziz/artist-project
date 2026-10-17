import uuid
from typing import Literal

from fastapi import APIRouter, Depends, Query, Response

from app.core.auth import current_admin
from app.models.artist import ArtistProfile
from app.models.user import User
from app.schemas.artist import (
    AdminArtistDetail,
    AdminArtistPage,
    ArtistOwner,
    RejectIn,
    RevealOut,
    admin_kyc_out,
    profile_out,
    summary_out,
)
from app.services.admin_artist_service import (
    AdminArtistService,
    get_admin_artist_service,
)
from app.services.storage import ImageStorage, get_storage
from app.shared.enums import ArtistStatus

router = APIRouter(prefix="/admin/artists", tags=["admin"])


def _detail(profile: ArtistProfile, owner: User, storage: ImageStorage) -> AdminArtistDetail:
    data = profile_out(profile, storage).model_dump(exclude={"kyc"})
    return AdminArtistDetail(**data, owner=ArtistOwner.model_validate(owner), kyc=admin_kyc_out(profile.kyc, storage))


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


@router.post("/{artist_id}/kyc/reveal", response_model=RevealOut)
async def reveal_aadhaar(
    artist_id: uuid.UUID,
    response: Response,
    admin: User = Depends(current_admin),
    service: AdminArtistService = Depends(get_admin_artist_service),
) -> RevealOut:
    response.headers["Cache-Control"] = "no-store"  # never let a proxy or browser keep the full number
    return RevealOut(aadhaar_number=await service.reveal_aadhaar(admin, artist_id))
