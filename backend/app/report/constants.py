"""Report periods and the on-demand exports. Phase 1 has no in-app payments: no revenue, commission or payout
reports; booking value is what each booking was worth."""

from typing import Literal

Period = Literal["7d", "30d", "quarter", "all"]
PERIOD_DAYS: dict[str, int | None] = {"7d": 7, "30d": 30, "quarter": 90, "all": None}
IST = "Asia/Kolkata"
EXPORT_MAX_ROWS = 50_000
UNKNOWN = "Unknown"

REPORTS = (
    "bookings",
    "bookings_by_city",
    "bookings_by_category",
    "bookings_by_week",
    "artists",
    "reviews",
    "support_tickets",
)
