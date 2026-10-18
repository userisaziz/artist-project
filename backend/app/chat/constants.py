"""Chat sides and request allowances (fixed windows, see app.core.rate_limit)."""

import enum

from app.core.rate_limit import Limit

MESSAGES_PER_USER = Limit(hits=300, window_seconds=3600)
MESSAGE_BURST_PER_USER = Limit(hits=20, window_seconds=60)
OPENS_PER_USER = Limit(hits=60, window_seconds=3600)
MESSAGE_MAX_LENGTH = 2000


class ChatSide(str, enum.Enum):
    """Which side of a conversation wrote a message, or is reading it."""

    customer = "customer"
    artist = "artist"
