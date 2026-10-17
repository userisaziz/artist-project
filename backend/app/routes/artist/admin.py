"""Admin review of artist profiles (/admin/artists…) and of custom services (/admin/custom-services…)."""

import uuid
from typing import Literal

from fastapi import APIRouter, Depends, Query, Response

from app.controllers.artist import admin as controller
from app.controllers.artist.dependencies import (
    get_admin_artist_service,
    get_custom_service_review,
)
from app.core.auth import current_admin
from app.schemas.artist.artist import (
    AdminArtistDetail,
    AdminArtistPage,
    AdminCustomServiceOut,
    AdminCustomServicePage,
    RejectIn,
    RevealOut,
)
from app.services.artist.admin import AdminArtistService
from app.services.artist.custom_service_review import CustomServiceReview
from app.services.upload.storage import ImageStorage, get_storage
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
    return await controller.list_artists(status, limit, cursor, service, storage)


@router.get("/artists/{artist_id}", response_model=AdminArtistDetail)
async def get_artist(
    artist_id: uuid.UUID,
    _: User = Depends(current_admin),
    service: AdminArtistService = Depends(get_admin_artist_service),
    storage: ImageStorage = Depends(get_storage),
) -> AdminArtistDetail:
    return await controller.get_artist(artist_id, service, storage)


@router.post("/artists/{artist_id}/approve", response_model=AdminArtistDetail)
async def approve_artist(
    artist_id: uuid.UUID,
    admin: User = Depends(current_admin),
    service: AdminArtistService = Depends(get_admin_artist_service),
    storage: ImageStorage = Depends(get_storage),
) -> AdminArtistDetail:
    return await controller.approve_artist(artist_id, admin, service, storage)


@router.post("/artists/{artist_id}/reject", response_model=AdminArtistDetail)
async def reject_artist(
    artist_id: uuid.UUID,
    body: RejectIn,
    admin: User = Depends(current_admin),
    service: AdminArtistService = Depends(get_admin_artist_service),
    storage: ImageStorage = Depends(get_storage),
) -> AdminArtistDetail:
    return await controller.reject_artist(artist_id, body.reason, admin, service, storage)


@router.post("/artists/{artist_id}/kyc/reveal", response_model=RevealOut)
async def reveal_aadhaar(
    artist_id: uuid.UUID,
    response: Response,
    admin: User = Depends(current_admin),
    service: AdminArtistService = Depends(get_admin_artist_service),
) -> RevealOut:
    return await controller.reveal_aadhaar(artist_id, response, admin, service)


@router.get("/custom-services", response_model=AdminCustomServicePage, dependencies=[Depends(current_admin)])
async def list_custom_services(
    status: Literal["pending", "approved", "rejected"] = "pending",
    limit: int = Query(20, ge=1, le=100),
    cursor: str | None = None,
    review: CustomServiceReview = Depends(get_custom_service_review),
) -> AdminCustomServicePage:
    return await controller.list_custom_services(status, limit, cursor, review)


@router.post("/custom-services/{service_id}/approve", response_model=AdminCustomServiceOut,
             dependencies=[Depends(current_admin)])
async def approve_custom_service(
    service_id: uuid.UUID, review: CustomServiceReview = Depends(get_custom_service_review)
) -> AdminCustomServiceOut:
    return await controller.approve_custom_service(service_id, review)


@router.post("/custom-services/{service_id}/reject", response_model=AdminCustomServiceOut,
             dependencies=[Depends(current_admin)])
async def reject_custom_service(
    service_id: uuid.UUID, body: RejectIn, review: CustomServiceReview = Depends(get_custom_service_review)
) -> AdminCustomServiceOut:
    return await controller.reject_custom_service(service_id, body.reason, review)
