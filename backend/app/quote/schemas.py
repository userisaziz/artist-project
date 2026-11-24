"""Enquiry and quote contracts, the same for customers and artists. Money is integer paise; dates are IST."""

import uuid
from datetime import date, datetime
from typing import Annotated, Any

from pydantic import AwareDatetime, Field, StringConstraints, field_validator

from app.artist.constants import MAX_QUANTITY, QuantityUnit
from app.booking.constants import MAX_BOOKING_ADDONS
from app.booking.schemas import BookingAddonIn
from app.catalog.fields import FieldAnswer
from app.quote.constants import (
    ADDRESS_MAX,
    DETAILS_MAX,
    DETAILS_MIN,
    DURATION_MAX,
    DURATION_MIN,
    DURATION_STEP,
    MAX_PAISE,
    MIN_PAISE,
    NOTE_MAX,
    REASON_MAX,
    EnquiryStatus,
)
from app.shared.schemas import APIModel

MAX_ALSO_SERVICES = 5  # more services quoted in one enquiry

Paise = Annotated[int, Field(ge=MIN_PAISE, le=MAX_PAISE)]


def _blank_is_none(value: str | None) -> str | None:
    return (value or "").strip() or None


class EnquiryIn(APIModel):
    artist_id: uuid.UUID
    event_date: date  # today (IST) up to the booking horizon; checked against the clock in the service
    details: Annotated[str, StringConstraints(strip_whitespace=True, min_length=DETAILS_MIN, max_length=DETAILS_MAX)]
    budget_paise: Paise | None = None
    service_id: uuid.UUID | None = None  # the service asked about, e.g. a made-to-order one
    quantity: int | None = Field(default=None, ge=1, le=MAX_QUANTITY)  # in the service's unit (boxes, cards…)
    answers: dict[str, Any] = Field(default_factory=dict)  # that service's booking fields, by key
    addons: list[BookingAddonIn] = Field(default_factory=list, max_length=MAX_BOOKING_ADDONS)  # from that service
    also_service_ids: list[uuid.UUID] = Field(default_factory=list, max_length=MAX_ALSO_SERVICES)


class QuoteIn(APIModel):
    price_paise: Paise
    duration_minutes: int = Field(ge=DURATION_MIN, le=DURATION_MAX, multiple_of=DURATION_STEP)
    note: str | None = Field(default=None, max_length=NOTE_MAX)
    valid_until: date  # today (IST) up to the event date; checked in the service

    _note = field_validator("note")(_blank_is_none)


class DeclineIn(APIModel):
    reason: str | None = Field(default=None, max_length=REASON_MAX)

    _reason = field_validator("reason")(_blank_is_none)


class AcceptIn(APIModel):
    """One of the offered starts for the quote, and where the appointment is."""

    start_at: AwareDatetime
    address: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=ADDRESS_MAX)]
    note: str | None = Field(default=None, max_length=NOTE_MAX)

    _note = field_validator("note")(_blank_is_none)


class EnquiryArtist(APIModel):
    id: uuid.UUID
    business_name: str
    photo_url: str | None
    city: str


class EnquiryCustomer(APIModel):
    first_name: str | None
    last_name: str | None


class QuoteOut(APIModel):
    price_paise: int
    duration_minutes: int
    note: str | None
    valid_until: date
    quoted_at: datetime


class EnquiryAddon(APIModel):
    name: str
    unit_price_paise: int
    per_person: bool
    guests: int
    line_paise: int


class EnquiryService(APIModel):
    id: uuid.UUID
    name: str


class EnquiryOut(APIModel):
    id: uuid.UUID
    status: EnquiryStatus
    event_date: date
    details: str
    budget_paise: int | None
    service_id: uuid.UUID | None
    service_name: str | None
    quantity: int | None
    quantity_unit: QuantityUnit | None  # what `quantity` counts, when the service is priced per unit
    answers: list[FieldAnswer]
    addons: list[EnquiryAddon]  # priced as listed when asked; the quote is the price that counts
    also_services: list[EnquiryService]  # more of the artist's services to quote for
    created_at: datetime
    artist: EnquiryArtist
    customer: EnquiryCustomer
    quote: QuoteOut | None
    decline_reason: str | None
    booking_id: uuid.UUID | None


class EnquiryPage(APIModel):
    items: list[EnquiryOut]
    next_cursor: str | None


class AcceptOut(APIModel):
    enquiry: EnquiryOut
    booking_id: uuid.UUID


class EnquirySummary(APIModel):
    open: int
    quoted: int
