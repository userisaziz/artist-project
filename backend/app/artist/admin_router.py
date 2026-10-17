"""Admin review of artist profiles (/admin/artists…) and of custom services (/admin/custom-services…)."""

import uuid
from typing import Literal

from fastapi import APIRouter, Depends, Query, Response

from app.artist.admin_service import AdminArtistService
from app.artist.custom_service_review import CustomServiceReview
from app.artist.dependencies import (
    get_admin_artist_service,
    get_custom_service_review,
)
from app.artist.schemas import (
    AdminArtistDetail,
    AdminArtistPage,
    AdminCustomServiceOut,
    AdminCustomServicePage,
    RejectIn,
    RevealOut,
)
from app.artist.utils import admin_detail_out, custom_service_out, summary_out
from app.core.auth import current_admin
from app.shared.enums import ArtistServiceStatus, ArtistStatus
from app.upload.service import ImageStorage, get_storage
from app.user.models import User

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/artists", response_model=AdminArtistPage)
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


@router.get("/artists/{artist_id}", response_model=AdminArtistDetail)
async def get_artist(
    artist_id: uuid.UUID,
    _: User = Depends(current_admin),
    service: AdminArtistService = Depends(get_admin_artist_service),
    storage: ImageStorage = Depends(get_storage),
) -> AdminArtistDetail:
    return admin_detail_out(*await service.get(artist_id), storage)


@router.post("/artists/{artist_id}/approve", response_model=AdminArtistDetail)
async def approve_artist(
    artist_id: uuid.UUID,
    admin: User = Depends(current_admin),
    service: AdminArtistService = Depends(get_admin_artist_service),
    storage: ImageStorage = Depends(get_storage),
) -> AdminArtistDetail:
    return admin_detail_out(*await service.approve(admin, artist_id), storage)


@router.post("/artists/{artist_id}/reject", response_model=AdminArtistDetail)
async def reject_artist(
    artist_id: uuid.UUID,
    body: RejectIn,
    admin: User = Depends(current_admin),
    service: AdminArtistService = Depends(get_admin_artist_service),
    storage: ImageStorage = Depends(get_storage),
) -> AdminArtistDetail:
    return admin_detail_out(*await service.reject(admin, artist_id, body.reason), storage)


@router.post("/artists/{artist_id}/kyc/reveal", response_model=RevealOut)
async def reveal_aadhaar(
    artist_id: uuid.UUID,
    response: Response,
    admin: User = Depends(current_admin),
    service: AdminArtistService = Depends(get_admin_artist_service),
) -> RevealOut:
    response.headers["Cache-Control"] = "no-store"  # never let a proxy or browser keep the full number
    return RevealOut(aadhaar_number=await service.reveal_aadhaar(admin, artist_id))


@router.get("/custom-services", response_model=AdminCustomServicePage, dependencies=[Depends(current_admin)])
async def list_custom_services(
    status: Literal["pending", "approved", "rejected"] = "pending",
    limit: int = Query(20, ge=1, le=100),
    cursor: str | None = None,
    review: CustomServiceReview = Depends(get_custom_service_review),
) -> AdminCustomServicePage:
    items, next_cursor = await review.list(ArtistServiceStatus(status), limit, cursor)
    return AdminCustomServicePage(items=[custom_service_out(row) for row in items], next_cursor=next_cursor)


@router.post(
    "/custom-services/{service_id}/approve", response_model=AdminCustomServiceOut, dependencies=[Depends(current_admin)]
)
async def approve_custom_service(
    service_id: uuid.UUID, review: CustomServiceReview = Depends(get_custom_service_review)
) -> AdminCustomServiceOut:
    return custom_service_out(await review.approve(service_id))


@router.post(
    "/custom-services/{service_id}/reject", response_model=AdminCustomServiceOut, dependencies=[Depends(current_admin)]
)
async def reject_custom_service(
    service_id: uuid.UUID, body: RejectIn, review: CustomServiceReview = Depends(get_custom_service_review)
) -> AdminCustomServiceOut:
    return custom_service_out(await review.reject(service_id, body.reason))
