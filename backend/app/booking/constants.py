"""Request allowances for booking writes (fixed windows, see app.core.rate_limit)."""

from enum import StrEnum

from app.core.rate_limit import Limit

BOOKING_REQUESTS_PER_USER = Limit(hits=30, window_seconds=3600)
REVIEWS_PER_USER = Limit(hits=30, window_seconds=3600)
RESCHEDULE_REQUESTS_PER_USER = Limit(hits=20, window_seconds=3600)

MAX_BOOKING_ADDONS = 10  # the most add-ons one service can have (app.artist.constants.MAX_ADDONS)
MAX_ADDON_GUESTS = 50  # per-person add-ons: guests booked in one go


class OverviewPeriod(StrEnum):
    """The admin Overview's date-range filter; each covers that many days back from now."""

    today = "today"
    last_7_days = "7d"
    last_30_days = "30d"
    quarter = "quarter"


OVERVIEW_PERIOD_DAYS = {
    OverviewPeriod.today: 1,
    OverviewPeriod.last_7_days: 7,
    OverviewPeriod.last_30_days: 30,
    OverviewPeriod.quarter: 90,
}
