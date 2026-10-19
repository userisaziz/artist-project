from typing import Literal

Segment = Literal["all", "new", "repeat", "blocked"]
CustomerStatus = Literal["active", "new", "blocked"]

NEW_DAYS = 30  # "New this month": joined within this many days
ACTIVE_DAYS = 30  # "Monthly active": requested a booking within this many days
RECENT_BOOKINGS = 5
EXPORT_MAX_ROWS = 10_000
EXPORT_COLUMNS = ["name", "phone", "email", "city", "bookings", "last_booking_at", "joined_at", "status"]
