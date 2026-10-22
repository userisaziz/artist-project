"""Request allowances for the public, unauthenticated reads (fixed windows, see app.core.rate_limit),
and how far ahead a storefront looks for its next free day."""

from app.core.rate_limit import Limit

PUBLIC_READS_PER_IP = Limit(hits=300, window_seconds=60)

# Days, today included, scanned for the storefront's "Next free" chip; each costs two queries.
NEXT_FREE_LOOKAHEAD_DAYS = 14
