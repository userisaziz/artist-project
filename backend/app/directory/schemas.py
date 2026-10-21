"""Public artist directory: what anyone can see about an approved artist. Never KYC, phone or review notes."""

import uuid
from datetime import date, datetime

from app.artist.schemas import NamedRef, WorkingHour
from app.shared.schemas import APIModel


class ArtistCard(APIModel):
    id: uuid.UUID
    business_name: str
    city: str
    photo_url: str | None
    cover_url: str | None  # first portfolio photo
    categories: list[NamedRef]
    from_price_paise: int | None  # cheapest approved service
    rating: float | None  # average of public reviews, one decimal; None until the first one
    review_count: int


class ArtistCardPage(APIModel):
    items: list[ArtistCard]
    next_cursor: str | None


class PublicPhoto(APIModel):
    id: uuid.UUID
    url: str
    thumb_url: str


class PublicService(APIModel):
    id: uuid.UUID
    name: str
    description: str | None
    price_paise: int
    duration_minutes: int
    category: NamedRef | None
    subcategory: NamedRef | None  # None for older rows that point straight at a top-level category


class ArtistPublic(ArtistCard):
    bio: str | None
    photos: list[PublicPhoto]
    services: list[PublicService]
    member_since: datetime | None
    completed_bookings: int
    travel_radius_km: int | None  # display only: how far the artist travels, never a search filter
    hours: list[WorkingHour]  # 7 items, Monday (0) first


class Slot(APIModel):
    start_at: datetime
    available: bool


class AvailabilityOut(APIModel):
    date: date
    slots: list[Slot]
