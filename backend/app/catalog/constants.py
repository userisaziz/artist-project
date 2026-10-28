"""Request allowances for the public catalog reads (fixed windows, see app.core.rate_limit), and how far a\ndropped pin may be from an area's centre and still snap to it."""

from app.core.rate_limit import Limit

PUBLIC_READS_PER_IP = Limit(hits=300, window_seconds=60)

# A pin further than this from every area's centre snaps to none: the artist picks their area by hand.
NEAREST_AREA_MAX_KM = 6.0

# Area search answers with at most this many places.
AREA_SEARCH_LIMIT = 10
