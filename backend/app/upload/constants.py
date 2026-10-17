"""Request allowances for upload signatures (fixed windows, see app.core.rate_limit)."""

from app.core.rate_limit import Limit

SIGNATURES_PER_USER = Limit(hits=300, window_seconds=3600)
