import uuid

from fastapi import APIRouter, Depends

from app.controllers.artist import artist as controller
from app.controllers.artist.dependencies import get_artist_service
from app.core.auth import current_artist
from app.schemas.artist.artist import (
    ArtistProfileOut,
    CustomServiceIn,
    CustomServicePatch,
    KycIn,
    PhotoIn,
    PhotoOrder,
    ProfileIn,
    ServiceIn,
    ServicePatch,
)
from app.services.artist.artist import ArtistService
from app.user.models import User

# Every write returns the whole profile, so the app re-renders from one response.
router = APIRouter(prefix="/artists/me", tags=["artists"])


@router.get("", response_model=ArtistProfileOut)
async def get_my_profile(
    user: User = Depends(current_artist), service: ArtistService = Depends(get_artist_service)
) -> ArtistProfileOut:
    return await controller.get_my_profile(user, service)


@router.put("/profile", response_model=ArtistProfileOut)
async def save_profile(
    body: ProfileIn, user: User = Depends(current_artist), service: ArtistService = Depends(get_artist_service)
) -> ArtistProfileOut:
    return await controller.save_profile(body, user, service)


@router.post("/services", response_model=ArtistProfileOut, status_code=201)
async def add_service(
    body: ServiceIn, user: User = Depends(current_artist), service: ArtistService = Depends(get_artist_service)
) -> ArtistProfileOut:
    return await controller.add_service(body, user, service)


@router.patch("/services/{service_id}", response_model=ArtistProfileOut)
async def update_service(
    service_id: uuid.UUID,
    body: ServicePatch,
    user: User = Depends(current_artist),
    service: ArtistService = Depends(get_artist_service),
) -> ArtistProfileOut:
    return await controller.update_service(service_id, body, user, service)


@router.delete("/services/{service_id}", response_model=ArtistProfileOut)
async def delete_service(
    service_id: uuid.UUID, user: User = Depends(current_artist), service: ArtistService = Depends(get_artist_service)
) -> ArtistProfileOut:
    return await controller.delete_service(service_id, user, service)


@router.post("/custom-services", response_model=ArtistProfileOut, status_code=201)
async def add_custom_service(
    body: CustomServiceIn, user: User = Depends(current_artist), service: ArtistService = Depends(get_artist_service)
) -> ArtistProfileOut:
    return await controller.add_custom_service(body, user, service)


@router.patch("/custom-services/{service_id}", response_model=ArtistProfileOut)
async def update_custom_service(
    service_id: uuid.UUID,
    body: CustomServicePatch,
    user: User = Depends(current_artist),
    service: ArtistService = Depends(get_artist_service),
) -> ArtistProfileOut:
    return await controller.update_custom_service(service_id, body, user, service)


@router.delete("/custom-services/{service_id}", response_model=ArtistProfileOut)
async def delete_custom_service(
    service_id: uuid.UUID, user: User = Depends(current_artist), service: ArtistService = Depends(get_artist_service)
) -> ArtistProfileOut:
    return await controller.delete_custom_service(service_id, user, service)


@router.post("/photos", response_model=ArtistProfileOut, status_code=201)
async def add_photo(
    body: PhotoIn, user: User = Depends(current_artist), service: ArtistService = Depends(get_artist_service)
) -> ArtistProfileOut:
    return await controller.add_photo(body, user, service)


@router.put("/photos/order", response_model=ArtistProfileOut)
async def reorder_photos(
    body: PhotoOrder, user: User = Depends(current_artist), service: ArtistService = Depends(get_artist_service)
) -> ArtistProfileOut:
    return await controller.reorder_photos(body, user, service)


@router.put("/kyc", response_model=ArtistProfileOut)
async def save_kyc(
    body: KycIn, user: User = Depends(current_artist), service: ArtistService = Depends(get_artist_service)
) -> ArtistProfileOut:
    return await controller.save_kyc(body, user, service)


@router.delete("/photos/{photo_id}", response_model=ArtistProfileOut)
async def delete_photo(
    photo_id: uuid.UUID, user: User = Depends(current_artist), service: ArtistService = Depends(get_artist_service)
) -> ArtistProfileOut:
    return await controller.delete_photo(photo_id, user, service)


@router.post("/submit", response_model=ArtistProfileOut)
async def submit(
    user: User = Depends(current_artist), service: ArtistService = Depends(get_artist_service)
) -> ArtistProfileOut:
    return await controller.submit(user, service)
