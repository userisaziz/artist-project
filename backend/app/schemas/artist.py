"""API contracts for artist onboarding and its admin review. Image fields are URLs built
from storage keys at response time (see services/storage.py); keys go in, URLs come out."""

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.models.artist import ArtistProfile, PortfolioPhoto
from app.services.storage import ImageStorage
from app.utils.enums import ArtistStatus


class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    slug: str
    name: str


class UploadRequest(BaseModel):
    purpose: Literal["artist_photo", "portfolio"]


class UploadOut(BaseModel):
    """POST `fields` plus the image (form field `file`) to `upload_url`, then send `key` to our API."""

    upload_url: str
    fields: dict[str, str]
    key: str


class ProfileIn(BaseModel):
    business_name: str = Field(min_length=1, max_length=120)
    city: str = Field(min_length=1, max_length=60)
    category_ids: list[int] = Field(min_length=1, max_length=6)
    photo_key: str | None = Field(default=None, max_length=255)
    bio: str | None = Field(default=None, max_length=1000)


class ServiceIn(BaseModel):
    category_id: int
    name: str = Field(min_length=1, max_length=120)
    price_paise: int = Field(gt=0, le=100_000_000)  # ≤ ₹10 lakh
    duration_minutes: int = Field(gt=0, le=1440)
    description: str | None = Field(default=None, max_length=1000)


class ServicePatch(BaseModel):
    category_id: int | None = None
    name: str | None = Field(default=None, min_length=1, max_length=120)
    price_paise: int | None = Field(default=None, gt=0, le=100_000_000)
    duration_minutes: int | None = Field(default=None, gt=0, le=1440)
    description: str | None = Field(default=None, max_length=1000)


class ServiceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    category_id: int
    name: str
    price_paise: int
    duration_minutes: int
    description: str | None = None


class PhotoIn(BaseModel):
    key: str = Field(min_length=1, max_length=255)
    width: int = Field(gt=0, le=20_000)
    height: int = Field(gt=0, le=20_000)


class PhotoOrder(BaseModel):
    photo_ids: list[uuid.UUID]


class PhotoOut(BaseModel):
    id: uuid.UUID
    key: str
    width: int
    height: int
    thumb_url: str
    card_url: str
    full_url: str


class ArtistProfileOut(BaseModel):
    id: uuid.UUID
    status: ArtistStatus
    business_name: str
    city: str
    bio: str | None
    photo_key: str | None
    photo_url: str | None
    categories: list[CategoryOut]
    services: list[ServiceOut]
    photos: list[PhotoOut]  # first = cover
    rejection_reason: str | None
    submitted_at: datetime | None
    reviewed_at: datetime | None


class RejectIn(BaseModel):
    reason: str = Field(min_length=1, max_length=500)


class ArtistOwner(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    phone: str
    first_name: str | None
    last_name: str | None
    email: str | None


class AdminArtistDetail(ArtistProfileOut):
    owner: ArtistOwner


class AdminArtistSummary(BaseModel):
    id: uuid.UUID
    status: ArtistStatus
    business_name: str
    city: str
    photo_url: str | None
    categories: list[str]
    service_count: int
    photo_count: int
    submitted_at: datetime | None


class AdminArtistPage(BaseModel):
    items: list[AdminArtistSummary]
    next_cursor: str | None


def photo_out(photo: PortfolioPhoto, storage: ImageStorage) -> PhotoOut:
    key = photo.storage_key
    return PhotoOut(
        id=photo.id, key=key, width=photo.width, height=photo.height,
        thumb_url=storage.url(key, "thumb"), card_url=storage.url(key, "card"), full_url=storage.url(key, "full"),
    )


def profile_out(profile: ArtistProfile, storage: ImageStorage) -> ArtistProfileOut:
    return ArtistProfileOut(
        id=profile.id,
        status=profile.status,
        business_name=profile.business_name,
        city=profile.city,
        bio=profile.bio,
        photo_key=profile.photo_key,
        photo_url=storage.url(profile.photo_key, "thumb") if profile.photo_key else None,
        categories=[CategoryOut.model_validate(c) for c in profile.categories],
        services=[ServiceOut.model_validate(s) for s in profile.services],
        photos=[photo_out(p, storage) for p in profile.photos],
        rejection_reason=profile.rejection_reason,
        submitted_at=profile.submitted_at,
        reviewed_at=profile.reviewed_at,
    )


def summary_out(profile: ArtistProfile, storage: ImageStorage) -> AdminArtistSummary:
    return AdminArtistSummary(
        id=profile.id,
        status=profile.status,
        business_name=profile.business_name,
        city=profile.city,
        photo_url=storage.url(profile.photo_key, "thumb") if profile.photo_key else None,
        categories=[c.name for c in profile.categories],
        service_count=len(profile.services),
        photo_count=len(profile.photos),
        submitted_at=profile.submitted_at,
    )
