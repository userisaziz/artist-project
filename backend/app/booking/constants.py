"""Request allowances for booking writes (fixed windows, see app.core.rate_limit)."""

from app.core.rate_limit import Limit

BOOKING_REQUESTS_PER_USER = Limit(hits=30, window_seconds=3600)
REVIEWS_PER_USER = Limit(hits=30, window_seconds=3600)
