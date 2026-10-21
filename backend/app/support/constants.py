"""Support topics, issues and the queue's vocabulary. Phase 1 has no in-app payments, so there is no payment
or payout issue type."""

import enum
from typing import Literal

from app.core.rate_limit import Limit

Topic = Literal["booking", "account"]
QueueView = Literal["open", "mine", "artists", "customers", "urgent", "resolved"]
RequesterSide = Literal["customer", "artist"]
Author = Literal["requester", "support"]

# topic -> issue code -> the subject shown everywhere
ISSUES: dict[str, dict[str, str]] = {
    "booking": {
        "artist_no_show": "Artist didn't show up",
        "not_as_booked": "Not what I booked",
        "customer_no_show": "Customer didn't show up",  # reported by the artist
        "other": "Something else about a booking",
    },
    "account": {
        "cant_log_in": "Can't log in",
        "change_number": "Change my number",
        "other": "Something else about my account",
    },
}
URGENT_ISSUES = {"artist_no_show", "customer_no_show"}

DETAILS_MAX = 500
MESSAGE_MAX = 1000
REPLY_MAX = 2000
RESPONSE_WINDOW_DAYS = 30  # median first response looks back this far
RESOLVED_WINDOW_DAYS = 7

TICKETS_PER_USER = Limit(hits=10, window_seconds=3600)
MESSAGES_PER_USER = Limit(hits=60, window_seconds=3600)


class TicketStatus(str, enum.Enum):
    """new: no reply yet. waiting_on_user: support replied. open: the requester wrote again. resolved: closed."""

    new = "new"
    open = "open"
    waiting_on_user = "waiting_on_user"
    resolved = "resolved"


class TicketPriority(str, enum.Enum):
    low = "low"
    normal = "normal"
    urgent = "urgent"
