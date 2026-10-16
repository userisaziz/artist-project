"""API contracts for artist onboarding and its admin review. Image fields are URLs built
from storage keys at response time (see services/storage.py); keys go in, URLs come out."""

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.models.artist import (
    ArtistKyc,
    ArtistProfile,
    ArtistServiceItem,
    PortfolioPhoto,
)
from app.services.storage import ImageStorage
from app.utils.aadhaar import mask_aadhaar_last4
from app.utils.enums import ArtistServiceStatus, ArtistStatus


class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    slug: str
    name: str


class TemplateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None = None


class SubcategoryOut(BaseModel):
    id: int
    slug: str
    name: str
    services: list[TemplateOut]


class CatalogCategoryOut(BaseModel):
    """The public tree. `CategoryOut` stays flat: it is also an artist's own category list."""

    id: int
    slug: str
    name: str
    subcategories: list[SubcategoryOut]


class UploadRequest(BaseModel):
    purpose: Literal["artist_photo", "portfolio", "aadhaar"]


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
    """Onboarding: a service from the admin's list, with the artist's own price and duration."""

    template_id: int
    price_paise: int = Field(gt=0, le=100_000_000)  # ≤ ₹10 lakh
    duration_minutes: int = Field(gt=0, le=1440)
    description: str | None = Field(default=None, max_length=1000)


class ServicePatch(BaseModel):
    price_paise: int | None = Field(default=None, gt=0, le=100_000_000)
    duration_minutes: int | None = Field(default=None, gt=0, le=1440)
    description: str | None = Field(default=None, max_length=1000)


class ServiceOut(BaseModel):
    id: uuid.UUID
    category_id: int
    subcategory_id: int  # the same column; pre-#6 rows point at a top-level category
    template_id: int | None  # None = custom service
    name: str
    price_paise: int
    duration_minutes: int
    description: str | None = None
    status: ArtistServiceStatus
    rejection_reason: str | None


def service_out(item: ArtistServiceItem) -> ServiceOut:
    return ServiceOut(
        id=item.id, category_id=item.category_id, subcategory_id=item.category_id, template_id=item.template_id,
        name=item.display_name, price_paise=item.price_paise, duration_minutes=item.duration_minutes,
        description=item.description, status=item.status, rejection_reason=item.rejection_reason,
    )


class CustomServiceIn(BaseModel):
    """After approval: the artist's own service under any active subcategory; waits for admin review."""

    subcategory_id: int
    name: str = Field(min_length=1, max_length=120)
    price_paise: int = Field(gt=0, le=100_000_000)
    duration_minutes: int = Field(gt=0, le=1440)
    description: str | None = Field(default=None, max_length=1000)


class CustomServicePatch(BaseModel):
    subcategory_id: int | None = None
    name: str | None = Field(default=None, min_length=1, max_length=120)
    price_paise: int | None = Field(default=None, gt=0, le=100_000_000)
    duration_minutes: int | None = Field(default=None, gt=0, le=1440)
    description: str | None = Field(default=None, max_length=1000)


class PhotoIn(BaseModel):
    key: str = Field(min_length=1, max_length=255)
    width: int = Field(gt=0, le=20_000)
    height: int = Field(gt=0, le=20_000)


class PhotoOrder(BaseModel):
    photo_ids: list[uuid.UUID]


class KycIn(BaseModel):
    # Format and checksum are checked in the service so errors keep the {code, message} contract.
    aadhaar_number: str = Field(max_length=20)
    front_key: str = Field(min_length=1, max_length=255)
    back_key: str = Field(min_length=1, max_length=255)


class KycOut(BaseModel):
    """What the artist sees about their own identity proof: never the number, keys or images."""

    aadhaar_last4: str


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
    kyc: KycOut | None
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


class AdminKycOut(BaseModel):
    aadhaar_masked: str
    front_url: str  # private, expiring (300 s)
    back_url: str


class AdminArtistDetail(ArtistProfileOut):
    owner: ArtistOwner
    kyc: AdminKycOut | None  # admin shape replaces the artist's {aadhaar_last4}


class RevealOut(BaseModel):
    aadhaar_number: str


def admin_kyc_out(kyc: ArtistKyc | None, storage: ImageStorage) -> AdminKycOut | None:
    if kyc is None:
        return None
    return AdminKycOut(
        aadhaar_masked=mask_aadhaar_last4(kyc.aadhaar_last4),
        front_url=storage.private_url(kyc.front_key),
        back_url=storage.private_url(kyc.back_key),
    )


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
        services=[service_out(s) for s in profile.services],
        photos=[photo_out(p, storage) for p in profile.photos],
        kyc=KycOut(aadhaar_last4=profile.kyc.aadhaar_last4) if profile.kyc else None,
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
