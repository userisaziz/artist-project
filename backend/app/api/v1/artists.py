import uuid

from fastapi import APIRouter, Depends

from app.core.auth import current_artist
from app.models.user import User
from app.schemas.artist import (
    ArtistProfileOut,
    CustomServiceIn,
    CustomServicePatch,
    KycIn,
    PhotoIn,
    PhotoOrder,
    ProfileIn,
    ServiceIn,
    ServicePatch,
    profile_out,
)
from app.services.artist_service import ArtistService, get_artist_service

# Every write returns the whole profile, so the app re-renders from one response.
router = APIRouter(prefix="/artists/me", tags=["artists"])


@router.get("", response_model=ArtistProfileOut)
async def get_my_profile(
    user: User = Depends(current_artist), service: ArtistService = Depends(get_artist_service)
) -> ArtistProfileOut:
    return profile_out(await service.get(user), service.storage)


@router.put("/profile", response_model=ArtistProfileOut)
async def save_profile(
    body: ProfileIn, user: User = Depends(current_artist), service: ArtistService = Depends(get_artist_service)
) -> ArtistProfileOut:
    return profile_out(await service.save_profile(user, body), service.storage)


@router.post("/services", response_model=ArtistProfileOut, status_code=201)
async def add_service(
    body: ServiceIn, user: User = Depends(current_artist), service: ArtistService = Depends(get_artist_service)
) -> ArtistProfileOut:
    return profile_out(await service.add_service(user, body), service.storage)


@router.patch("/services/{service_id}", response_model=ArtistProfileOut)
async def update_service(
    service_id: uuid.UUID,
    body: ServicePatch,
    user: User = Depends(current_artist),
    service: ArtistService = Depends(get_artist_service),
) -> ArtistProfileOut:
    return profile_out(await service.update_service(user, service_id, body), service.storage)


@router.delete("/services/{service_id}", response_model=ArtistProfileOut)
async def delete_service(
    service_id: uuid.UUID, user: User = Depends(current_artist), service: ArtistService = Depends(get_artist_service)
) -> ArtistProfileOut:
    return profile_out(await service.delete_service(user, service_id), service.storage)


@router.post("/custom-services", response_model=ArtistProfileOut, status_code=201)
async def add_custom_service(
    body: CustomServiceIn, user: User = Depends(current_artist), service: ArtistService = Depends(get_artist_service)
) -> ArtistProfileOut:
    return profile_out(await service.add_custom_service(user, body), service.storage)


@router.patch("/custom-services/{service_id}", response_model=ArtistProfileOut)
async def update_custom_service(
    service_id: uuid.UUID,
    body: CustomServicePatch,
    user: User = Depends(current_artist),
    service: ArtistService = Depends(get_artist_service),
) -> ArtistProfileOut:
    return profile_out(await service.update_custom_service(user, service_id, body), service.storage)


@router.delete("/custom-services/{service_id}", response_model=ArtistProfileOut)
async def delete_custom_service(
    service_id: uuid.UUID, user: User = Depends(current_artist), service: ArtistService = Depends(get_artist_service)
) -> ArtistProfileOut:
    return profile_out(await service.delete_custom_service(user, service_id), service.storage)


@router.post("/photos", response_model=ArtistProfileOut, status_code=201)
async def add_photo(
    body: PhotoIn, user: User = Depends(current_artist), service: ArtistService = Depends(get_artist_service)
) -> ArtistProfileOut:
    return profile_out(await service.add_photo(user, body), service.storage)


@router.put("/photos/order", response_model=ArtistProfileOut)
async def reorder_photos(
    body: PhotoOrder, user: User = Depends(current_artist), service: ArtistService = Depends(get_artist_service)
) -> ArtistProfileOut:
    return profile_out(await service.reorder_photos(user, body.photo_ids), service.storage)


@router.put("/kyc", response_model=ArtistProfileOut)
async def save_kyc(
    body: KycIn, user: User = Depends(current_artist), service: ArtistService = Depends(get_artist_service)
) -> ArtistProfileOut:
    return profile_out(await service.save_kyc(user, body), service.storage)


@router.delete("/photos/{photo_id}", response_model=ArtistProfileOut)
async def delete_photo(
    photo_id: uuid.UUID, user: User = Depends(current_artist), service: ArtistService = Depends(get_artist_service)
) -> ArtistProfileOut:
    return profile_out(await service.delete_photo(user, photo_id), service.storage)


@router.post("/submit", response_model=ArtistProfileOut)
async def submit(
    user: User = Depends(current_artist), service: ArtistService = Depends(get_artist_service)
) -> ArtistProfileOut:
    return profile_out(await service.submit(user), service.storage)
