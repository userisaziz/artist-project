"""Request allowances for the public, unauthenticated reads (fixed windows, see app.core.rate_limit),
how far ahead a storefront looks for its next free day, and the Explore search knobs."""

from enum import StrEnum

from app.core.rate_limit import Limit

PUBLIC_READS_PER_IP = Limit(hits=300, window_seconds=60)

# Days, today included, scanned for the storefront's "Next free" chip; each costs two queries.
NEXT_FREE_LOOKAHEAD_DAYS = 14

# Explore cards show the first few portfolio photos as a mosaic.
CARD_PHOTOS = 3

# "Recommended" ranks a Bayesian average: every artist starts with this many reviews at this rating, so one
# 5-star review doesn't outrank a long record of 4.8s.
RECOMMENDED_PRIOR_RATING = 4.0
RECOMMENDED_PRIOR_REVIEWS = 5

EARTH_RADIUS_KM = 6371.0

# A free-date search checks each candidate's real slots (two queries each), so one page scans at most this many.
AVAILABLE_ON_SCAN_LIMIT = 100


class DirectorySort(StrEnum):
    recent = "recent"  # most recently approved first (the default; keyset paging)
    recommended = "recommended"
    rating = "rating"
    price = "price"  # cheapest "from" price first
    nearest = "nearest"  # needs near_lat/near_lng
