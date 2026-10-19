"""Booking contracts for customers, artists and admins. Money is integer paise; times are UTC ISO strings."""

import uuid
from datetime import date, datetime

from pydantic import Field, field_validator

from app.shared.enums import BookingStatus, ReviewStatus
from app.shared.schemas import APIModel


class BookingIn(APIModel):
    artist_id: uuid.UUID
    service_id: uuid.UUID
    start_at: datetime
    address: str = Field(min_length=1, max_length=300)
    note: str | None = Field(default=None, max_length=500)

    @field_validator("address")
    @classmethod
    def _address_not_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Enter the address for the appointment")
        return value

    @field_validator("note")
    @classmethod
    def _blank_note_is_none(cls, value: str | None) -> str | None:
        return (value or "").strip() or None


class ReasonIn(APIModel):
    """Optional reason: customer cancel, artist decline."""

    reason: str | None = Field(default=None, max_length=500)


class BookingArtist(APIModel):
    id: uuid.UUID
    business_name: str
    photo_url: str | None
    city: str


class BookingCustomer(APIModel):
    id: uuid.UUID
    first_name: str | None
    last_name: str | None


class AdminBookingCustomer(BookingCustomer):
    phone: str


class BookingReview(APIModel):
    id: uuid.UUID
    rating: int
    status: ReviewStatus


class BookingOut(APIModel):
    id: uuid.UUID
    code: str
    status: BookingStatus
    start_at: datetime
    end_at: datetime
    address: str
    note: str | None
    service_name: str
    duration_minutes: int
    artist: BookingArtist
    customer: BookingCustomer
    subtotal_paise: int
    platform_fee_paise: int
    total_paise: int
    deposit_paise: int
    balance_paise: int
    commission_paise: int | None  # None when shown to the customer
    artist_earning_paise: int | None
    deposit_paid_at: datetime | None
    expires_at: datetime
    responded_at: datetime | None
    cancelled_at: datetime | None
    completed_at: datetime | None
    decline_reason: str | None
    cancel_reason: str | None
    cancelled_by: str | None
    refund_due: bool | None
    created_at: datetime
    review: BookingReview | None
    can_review: bool  # completed, within the review window, not reviewed yet


class AdminBookingOut(BookingOut):
    customer: AdminBookingCustomer


class BookingPage(APIModel):
    items: list[BookingOut]
    next_cursor: str | None


class AdminBookingPage(APIModel):
    items: list[AdminBookingOut]
    next_cursor: str | None


class ArtistDashboard(APIModel):
    requests: int
    upcoming: int
    completed_this_month: int
    earnings_this_month_paise: int
    today: list[BookingOut]


class WeekCount(APIModel):
    week_start: date
    count: int


class AdminOverview(APIModel):
    """Booking figures cover the chosen period (and city); `_previous` is the same-length period before it."""

    period_days: int
    gross_paise: int
    gross_paise_previous: int
    bookings: int
    bookings_previous: int
    completed: int
    cancelled: int
    new_artists: int  # approved during the period
    awaiting_artist: int
    pending_artists: int
    pending_custom_services: int
    flagged_reviews: int  # flagged, or auto-hidden with no moderator decision yet
    bookings_by_week: list[WeekCount]
    cities: list[str]  # every city with an approved artist, for the city filter
