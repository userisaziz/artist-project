"""Chat sides and request allowances (fixed windows, see app.core.rate_limit)."""

import enum

from app.core.rate_limit import Limit

MESSAGES_PER_USER = Limit(hits=300, window_seconds=3600)
MESSAGE_BURST_PER_USER = Limit(hits=20, window_seconds=60)
OPENS_PER_USER = Limit(hits=60, window_seconds=3600)
MESSAGE_MAX_LENGTH = 2000


class ChatSide(enum.StrEnum):
    """Which side of a conversation wrote a message, or is reading it."""

    customer = "customer"
    artist = "artist"


class MessageModeration(enum.StrEnum):
    """A message the contact filter caught. `held`: only the sender sees it until an admin decides; `allowed`:
    delivered as normal; `hidden`: never delivered, the sender is told why. Unflagged messages have none."""

    held = "held"
    allowed = "allowed"
    hidden = "hidden"


# A storefront shows "replies in" only once the artist has answered this many customer messages.
REPLY_TIME_MIN_REPLIES = 5
ENQUIRIES_PER_PAGE = 20
ENQUIRY_SUMMARY_DAYS = 7
