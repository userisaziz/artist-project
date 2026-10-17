"""The signed-in artist's own profile. Every write returns the whole profile, so the app re-renders from one response."""

import uuid

from app.controllers.artist.presenters import profile_out
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


async def get_my_profile(user: User, service: ArtistService) -> ArtistProfileOut:
    return profile_out(await service.get(user), service.storage)


async def save_profile(body: ProfileIn, user: User, service: ArtistService) -> ArtistProfileOut:
    return profile_out(await service.save_profile(user, body), service.storage)


async def add_service(body: ServiceIn, user: User, service: ArtistService) -> ArtistProfileOut:
    return profile_out(await service.add_service(user, body), service.storage)


async def update_service(service_id: uuid.UUID, body: ServicePatch, user: User, service: ArtistService) -> ArtistProfileOut:
    return profile_out(await service.update_service(user, service_id, body), service.storage)


async def delete_service(service_id: uuid.UUID, user: User, service: ArtistService) -> ArtistProfileOut:
    return profile_out(await service.delete_service(user, service_id), service.storage)


async def add_custom_service(body: CustomServiceIn, user: User, service: ArtistService) -> ArtistProfileOut:
    return profile_out(await service.add_custom_service(user, body), service.storage)


async def update_custom_service(
    service_id: uuid.UUID, body: CustomServicePatch, user: User, service: ArtistService
) -> ArtistProfileOut:
    return profile_out(await service.update_custom_service(user, service_id, body), service.storage)


async def delete_custom_service(service_id: uuid.UUID, user: User, service: ArtistService) -> ArtistProfileOut:
    return profile_out(await service.delete_custom_service(user, service_id), service.storage)


async def add_photo(body: PhotoIn, user: User, service: ArtistService) -> ArtistProfileOut:
    return profile_out(await service.add_photo(user, body), service.storage)


async def reorder_photos(body: PhotoOrder, user: User, service: ArtistService) -> ArtistProfileOut:
    return profile_out(await service.reorder_photos(user, body.photo_ids), service.storage)


async def save_kyc(body: KycIn, user: User, service: ArtistService) -> ArtistProfileOut:
    return profile_out(await service.save_kyc(user, body), service.storage)


async def delete_photo(photo_id: uuid.UUID, user: User, service: ArtistService) -> ArtistProfileOut:
    return profile_out(await service.delete_photo(user, photo_id), service.storage)


async def submit(user: User, service: ArtistService) -> ArtistProfileOut:
    return profile_out(await service.submit(user), service.storage)
