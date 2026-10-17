"""Request allowances for the public, unauthenticated reads (fixed windows, see app.core.rate_limit)."""

from app.core.rate_limit import Limit

PUBLIC_READS_PER_IP = Limit(hits=300, window_seconds=60)
