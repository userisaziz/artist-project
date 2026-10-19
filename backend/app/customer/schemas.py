"""Admin customer contracts. Phase 1 takes no in-app payments, so there is no spend or order value here."""

import uuid
from datetime import datetime
from typing import Annotated

from pydantic import StringConstraints

from app.customer.constants import CustomerStatus
from app.shared.enums import BookingStatus
from app.shared.schemas import APIModel


class CustomerRow(APIModel):
    id: uuid.UUID
    name: str
    phone: str
    email: str | None
    city: str | None  # the city of their latest booking's artist
    bookings: int
    last_booking_at: datetime | None
    joined_at: datetime
    status: CustomerStatus


class CustomerPage(APIModel):
    items: list[CustomerRow]
    next_cursor: str | None


class SegmentCounts(APIModel):
    all: int
    new: int
    repeat: int
    blocked: int


class CustomerSummary(APIModel):
    counts: SegmentCounts
    monthly_active: int  # customers who requested a booking in the last 30 days
    repeat_rate: float | None  # share of customers with a booking who have two or more; None with none


class RecentBooking(APIModel):
    id: uuid.UUID
    code: str
    artist_name: str
    service_name: str
    start_at: datetime
    status: BookingStatus
    total_paise: int


class CustomerDetail(CustomerRow):
    blocked_at: datetime | None
    blocked_reason: str | None
    reviews: int
    recent_bookings: list[RecentBooking]


class BlockIn(APIModel):
    reason: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=500)]
