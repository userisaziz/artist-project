"""Public artist directory: what anyone can see about an approved artist. Never KYC, phone or review notes."""

import uuid
from datetime import date, datetime

from app.artist.schemas import AddonOut, NamedRef, WorkingHour
from app.shared.schemas import APIModel


class ArtistCard(APIModel):
    id: uuid.UUID
    business_name: str
    city: str
    locality: str | None  # the area the artist works from; never the address
    photo_url: str | None
    cover_url: str | None  # first portfolio photo
    photo_urls: list[str]  # first few portfolio photos, for Explore's mosaic
    categories: list[NamedRef]
    from_price_paise: int | None  # cheapest approved service
    rating: float | None  # average of public reviews, one decimal; None until the first one
    review_count: int
    distance_km: float | None  # from the search point (near_lat/near_lng), one decimal; None without one
    free_on: date | None  # the searched available_on day, when the artist has an open slot then


class ArtistCardPage(APIModel):
    items: list[ArtistCard]
    next_cursor: str | None
    total: int | None = None  # every match across pages; None when not counted (free-date search, saved lists)
    radius_km: float | None = None  # near a point: the radius applied; None without a point or with no limit


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
    booking_count: int  # completed bookings of this service
    photo_url: str | None  # the package's own photo, card size
    included_items: list[str]
    addons: list[AddonOut]  # priced extras a customer can pick when booking


class ArtistPublic(ArtistCard):
    bio: str | None
    photos: list[PublicPhoto]
    services: list[PublicService]
    member_since: datetime | None
    completed_bookings: int
    travel_radius_km: int | None  # display only: how far the artist travels, never a search filter
    experience_years: int | None
    languages: list[str]  # in the artist's order
    hours: list[WorkingHour]  # 7 items, Monday (0) first
    next_free_date: date | None  # first IST day with an open slot for the shortest service, within the lookahead
    reply_minutes: int | None  # median time to answer a customer message; None until there are enough replies


class Slot(APIModel):
    start_at: datetime
    available: bool


class AvailabilityOut(APIModel):
    date: date
    slots: list[Slot]
