"""Enquiry vocabulary and limits. Phase 1 has no in-app payments: a quote is a price the customer pays the artist
directly after the service, like any booking."""

from enum import StrEnum
from typing import Literal

from app.core.rate_limit import Limit


class EnquiryStatus(StrEnum):
    """open (no quote yet) → quoted (re-quotable) → accepted (booked); or declined by the artist, cancelled by the
    customer, or expired (the quote's valid-until date or the event date passed; applied lazily on read)."""

    open = "open"
    quoted = "quoted"
    accepted = "accepted"
    declined = "declined"
    cancelled = "cancelled"
    expired = "expired"


LIVE = (EnquiryStatus.open, EnquiryStatus.quoted)
CLOSED = (EnquiryStatus.accepted, EnquiryStatus.declined, EnquiryStatus.cancelled, EnquiryStatus.expired)
ArtistView = Literal["open", "quoted", "closed"]

DETAILS_MIN = 10
DETAILS_MAX = 1000
NOTE_MAX = 500
REASON_MAX = 500
ADDRESS_MAX = 300
MIN_PAISE = 100
MAX_PAISE = 1_000_000_000  # ₹1 crore: keeps every booking money column inside a 32-bit integer
DURATION_MIN = 30
DURATION_MAX = 720
DURATION_STEP = 30

ENQUIRIES_PER_USER = Limit(hits=20, window_seconds=3600)

DUPLICATE = "You already have an open enquiry with this artist"
NOT_ACCEPTABLE = "This quote can't be accepted"
