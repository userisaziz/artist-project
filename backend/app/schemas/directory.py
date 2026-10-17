"""Public artist directory: what anyone can see about an approved artist. Never KYC, phone or review notes."""

import uuid
from datetime import date, datetime

from pydantic import BaseModel

from app.schemas.artist.artist import NamedRef


class ArtistCard(BaseModel):
    id: uuid.UUID
    business_name: str
    city: str
    photo_url: str | None
    cover_url: str | None  # first portfolio photo
    categories: list[NamedRef]
    from_price_paise: int | None  # cheapest approved service
    rating: float | None  # average of public reviews, one decimal; None until the first one
    review_count: int


class ArtistCardPage(BaseModel):
    items: list[ArtistCard]
    next_cursor: str | None


class PublicPhoto(BaseModel):
    id: uuid.UUID
    url: str
    thumb_url: str


class PublicService(BaseModel):
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


class Slot(BaseModel):
    start_at: datetime
    available: bool


class AvailabilityOut(BaseModel):
    date: date
    slots: list[Slot]
