"""Artist schedule defaults and limits. Hours are whole IST hours; weekday 0 is Monday (ISO weekday - 1)."""

DEFAULT_OPEN_HOUR = 8  # artists who never set hours work every day 08:00-20:00
DEFAULT_CLOSE_HOUR = 20
WEEKDAYS = 7
MIN_TRAVEL_RADIUS_KM = 1
MAX_TRAVEL_RADIUS_KM = 100

# Service extras: "What's included" lines and priced add-ons a customer can pick.
MAX_INCLUDED_ITEMS = 8
INCLUDED_ITEM_MAX_LENGTH = 60
MAX_ADDONS = 10
ADDON_NAME_MAX_LENGTH = 80
MAX_PRICE_PAISE = 100_000_000  # ≤ ₹10 lakh
