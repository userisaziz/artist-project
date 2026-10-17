"""Admin review of artist profiles (with the Aadhaar reveal) and of custom services."""

import uuid

from fastapi import Response

from app.controllers.artist.presenters import (
    admin_detail_out,
    custom_service_out,
    summary_out,
)
from app.schemas.artist.artist import (
    AdminArtistDetail,
    AdminArtistPage,
    AdminCustomServiceOut,
    AdminCustomServicePage,
    RevealOut,
)
from app.services.artist.admin import AdminArtistService
from app.services.artist.custom_service_review import CustomServiceReview
from app.services.upload.storage import ImageStorage
from app.shared.enums import ArtistServiceStatus, ArtistStatus
from app.user.models import User


async def list_artists(
    status: str, limit: int, cursor: str | None, service: AdminArtistService, storage: ImageStorage
) -> AdminArtistPage:
    items, next_cursor = await service.list(ArtistStatus(status), limit, cursor)
    return AdminArtistPage(items=[summary_out(p, storage) for p in items], next_cursor=next_cursor)


async def get_artist(artist_id: uuid.UUID, service: AdminArtistService, storage: ImageStorage) -> AdminArtistDetail:
    return admin_detail_out(*await service.get(artist_id), storage)


async def approve_artist(
    artist_id: uuid.UUID, admin: User, service: AdminArtistService, storage: ImageStorage
) -> AdminArtistDetail:
    return admin_detail_out(*await service.approve(admin, artist_id), storage)


async def reject_artist(
    artist_id: uuid.UUID, reason: str, admin: User, service: AdminArtistService, storage: ImageStorage
) -> AdminArtistDetail:
    return admin_detail_out(*await service.reject(admin, artist_id, reason), storage)


async def reveal_aadhaar(artist_id: uuid.UUID, response: Response, admin: User, service: AdminArtistService) -> RevealOut:
    response.headers["Cache-Control"] = "no-store"  # never let a proxy or browser keep the full number
    return RevealOut(aadhaar_number=await service.reveal_aadhaar(admin, artist_id))


async def list_custom_services(
    status: str, limit: int, cursor: str | None, review: CustomServiceReview
) -> AdminCustomServicePage:
    items, next_cursor = await review.list(ArtistServiceStatus(status), limit, cursor)
    return AdminCustomServicePage(items=[custom_service_out(row) for row in items], next_cursor=next_cursor)


async def approve_custom_service(service_id: uuid.UUID, review: CustomServiceReview) -> AdminCustomServiceOut:
    return custom_service_out(await review.approve(service_id))


async def reject_custom_service(service_id: uuid.UUID, reason: str, review: CustomServiceReview) -> AdminCustomServiceOut:
    return custom_service_out(await review.reject(service_id, reason))
