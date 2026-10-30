"""What a customer can save, and how often (fixed windows, see app.core.rate_limit)."""

import enum

from app.core.rate_limit import Limit

SAVES_PER_USER = Limit(hits=600, window_seconds=3600)  # same allowance as feed reactions


class SavedKind(enum.StrEnum):
    post = "post"
    artist = "artist"
    product = "product"
