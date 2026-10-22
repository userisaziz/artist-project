"""Admin artist directory contracts. `booking_value_30d` is the value of completed bookings: phase 1 takes no
in-app payments, so this is what customers paid artists directly, not money the platform handled."""

import uuid
from datetime import datetime
from typing import Annotated

from pydantic import StringConstraints

from app.shared.enums import ArtistStatus
from app.shared.schemas import APIModel


class DirectoryRow(APIModel):
    id: uuid.UUID
    business_name: str
    photo_url: str | None
    category: str | None  # the first of the artist's categories
    city: str
    status: ArtistStatus
    rating_average: float | None
    rating_count: int
    bookings_total: int  # completed bookings, ever
    booking_value_30d: int  # paise, completed in the last 30 days
    open_complaints: int | None  # None until complaints are tracked
    created_at: datetime
    missing_requirements: list[str]  # keys of mandatory profile requirements not met yet (e.g. "location")


class DirectoryPage(APIModel):
    items: list[DirectoryRow]
    next_cursor: str | None


class DirectoryCounts(APIModel):
    all: int
    approved: int
    pending: int
    suspended: int
    on_hold: int  # approved, but hidden for an overdue profile requirement


class DirectorySummary(APIModel):
    counts: DirectoryCounts
    active_artists: int
    new_this_month: int
    avg_rating: float | None
    total_reviews: int
    median_response_minutes: float | None
    at_risk: int


class SuspensionOut(APIModel):
    id: uuid.UUID
    status: ArtistStatus
    suspension_reason: str | None
    suspended_at: datetime | None


class SuspendIn(APIModel):
    reason: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=500)]
