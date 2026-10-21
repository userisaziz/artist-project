"""API contracts for artist onboarding and its admin review. Image fields are URLs built
from storage keys at response time (see presenters.py); keys go in, URLs come out."""

import uuid
from datetime import date, datetime
from typing import Annotated

from pydantic import Field, StringConstraints, model_validator

from app.artist.constants import MAX_TRAVEL_RADIUS_KM, MIN_TRAVEL_RADIUS_KM, WEEKDAYS
from app.shared.enums import ArtistServiceStatus, ArtistStatus
from app.shared.schemas import APIModel, ORMModel
from app.subcategory_request.schemas import SuggestedSubcategoryIn, SuggestedSubcategoryOut


class CategoryOut(ORMModel):
    id: int
    slug: str
    name: str


class ProfileIn(APIModel):
    business_name: str = Field(min_length=1, max_length=120)
    city: str = Field(min_length=1, max_length=60)
    category_ids: list[int] = Field(min_length=1, max_length=6)
    photo_key: str | None = Field(default=None, max_length=255)
    bio: str | None = Field(default=None, max_length=1000)


class ServiceIn(APIModel):
    """Onboarding: a service from the admin's list, with the artist's own price and duration."""

    template_id: int
    price_paise: int = Field(gt=0, le=100_000_000)  # ≤ ₹10 lakh
    duration_minutes: int = Field(gt=0, le=1440)
    description: str | None = Field(default=None, max_length=1000)


class ServicePatch(APIModel):
    price_paise: int | None = Field(default=None, gt=0, le=100_000_000)
    duration_minutes: int | None = Field(default=None, gt=0, le=1440)
    description: str | None = Field(default=None, max_length=1000)


class ServiceOut(APIModel):
    id: uuid.UUID
    category_id: int
    subcategory_id: int  # the same column; pre-#6 rows and suggestion-waiting rows point at a top-level category
    template_id: int | None  # None = custom service
    name: str
    price_paise: int
    duration_minutes: int
    description: str | None = None
    status: ArtistServiceStatus
    rejection_reason: str | None
    suggested_subcategory: SuggestedSubcategoryOut | None = None  # the artist's own suggestion it was filed under


class CustomServiceIn(APIModel):
    """After approval: the artist's own service under any active subcategory, or under a subcategory they suggest
    (exactly one of the two); waits for admin review."""

    subcategory_id: int | None = None
    suggested_subcategory: SuggestedSubcategoryIn | None = None
    name: str = Field(min_length=1, max_length=120)
    price_paise: int = Field(gt=0, le=100_000_000)
    duration_minutes: int = Field(gt=0, le=1440)
    description: str | None = Field(default=None, max_length=1000)

    @model_validator(mode="after")
    def one_place(self) -> "CustomServiceIn":
        if (self.subcategory_id is None) == (self.suggested_subcategory is None):
            raise ValueError("Pick a subcategory or suggest one, not both")
        return self


class CustomServicePatch(APIModel):
    subcategory_id: int | None = None
    name: str | None = Field(default=None, min_length=1, max_length=120)
    price_paise: int | None = Field(default=None, gt=0, le=100_000_000)
    duration_minutes: int | None = Field(default=None, gt=0, le=1440)
    description: str | None = Field(default=None, max_length=1000)


class PhotoIn(APIModel):
    key: str = Field(min_length=1, max_length=255)
    width: int = Field(gt=0, le=20_000)
    height: int = Field(gt=0, le=20_000)


class PhotoOrder(APIModel):
    photo_ids: list[uuid.UUID]


class KycIn(APIModel):
    # Format and checksum are checked in the service so errors keep the {code, message} contract.
    aadhaar_number: str = Field(max_length=20)
    front_key: str = Field(min_length=1, max_length=255)
    back_key: str = Field(min_length=1, max_length=255)


class KycOut(APIModel):
    """What the artist sees about their own identity proof: never the number, keys or images."""

    aadhaar_last4: str


class PhotoOut(APIModel):
    id: uuid.UUID
    key: str
    width: int
    height: int
    thumb_url: str
    card_url: str
    full_url: str


class ArtistProfileOut(APIModel):
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


class RejectIn(APIModel):
    """A required reason (reject an artist or a service, cancel a booking); whitespace alone doesn't count."""

    reason: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=500)]


class ArtistOwner(ORMModel):
    id: uuid.UUID
    phone: str
    first_name: str | None
    last_name: str | None
    email: str | None


class AdminKycOut(APIModel):
    aadhaar_masked: str
    front_url: str  # private, expiring (300 s)
    back_url: str


class AdminArtistDetail(ArtistProfileOut):
    owner: ArtistOwner
    kyc: AdminKycOut | None  # type: ignore[assignment]  # admin shape deliberately replaces {aadhaar_last4}


class RevealOut(APIModel):
    aadhaar_number: str


class AdminArtistSummary(APIModel):
    id: uuid.UUID
    status: ArtistStatus
    business_name: str
    city: str
    photo_url: str | None
    categories: list[str]
    service_count: int
    photo_count: int
    submitted_at: datetime | None
    reviewed_at: datetime | None  # set on a pending profile: approved or rejected before, so this is a re-review


class AdminArtistPage(APIModel):
    items: list[AdminArtistSummary]
    next_cursor: str | None


class NamedRef(APIModel):
    id: int
    name: str


class AdminCustomServiceOut(APIModel):
    id: uuid.UUID
    artist_id: uuid.UUID
    business_name: str
    category: NamedRef | None  # None for pre-#6 rows, which point straight at a top-level category
    subcategory: NamedRef
    name: str
    price_paise: int
    duration_minutes: int
    description: str | None
    status: ArtistServiceStatus
    rejection_reason: str | None
    created_at: datetime


class AdminCustomServicePage(APIModel):
    items: list[AdminCustomServiceOut]
    next_cursor: str | None


class WorkingHour(APIModel):
    """One weekday, IST whole hours. Closed days still carry hours, so reopening one restores them."""

    weekday: int = Field(ge=0, le=WEEKDAYS - 1)  # 0 = Monday
    is_open: bool
    open_hour: int = Field(ge=0, le=23)
    close_hour: int = Field(ge=1, le=24)

    @model_validator(mode="after")
    def _closes_after_opening(self) -> "WorkingHour":
        if self.close_hour <= self.open_hour:
            raise ValueError("close_hour must be after open_hour")
        return self


TravelRadius = Annotated[int, Field(ge=MIN_TRAVEL_RADIUS_KM, le=MAX_TRAVEL_RADIUS_KM)]


class ScheduleIn(APIModel):
    hours: list[WorkingHour] = Field(min_length=WEEKDAYS, max_length=WEEKDAYS)
    travel_radius_km: TravelRadius | None = None  # display only; null (or left out) clears it

    @model_validator(mode="after")
    def _every_weekday_once(self) -> "ScheduleIn":
        if {h.weekday for h in self.hours} != set(range(WEEKDAYS)):
            raise ValueError("hours needs each weekday 0-6 exactly once")
        return self


class ScheduleOut(APIModel):
    hours: list[WorkingHour]  # 7 items, by weekday
    days_off: list[date]  # today (IST) onward, ascending
    travel_radius_km: int | None
