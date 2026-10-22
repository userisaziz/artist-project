"""Artist schedule defaults and limits. Hours are whole IST hours; weekday 0 is Monday (ISO weekday - 1).
Also the profile's storefront details: years of experience and the languages an artist can work in."""

from enum import StrEnum

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

# Storefront profile details.
MAX_EXPERIENCE_YEARS = 60


class Language(StrEnum):
    """Languages an artist can talk to clients in, as the storefront shows them."""

    english = "English"
    hindi = "Hindi"
    kannada = "Kannada"
    tamil = "Tamil"
    telugu = "Telugu"
    malayalam = "Malayalam"
    marathi = "Marathi"
    bengali = "Bengali"
    gujarati = "Gujarati"
    punjabi = "Punjabi"
    urdu = "Urdu"
