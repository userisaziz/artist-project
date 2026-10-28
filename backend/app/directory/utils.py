"""Explore search filters, built from the query string by `dependencies.search_filters`, and the cursor of a search
near a point, which carries the radius chosen on its first page."""

import base64
from dataclasses import dataclass
from datetime import date

from app.core.exceptions import ValidationError
from app.directory.constants import MAX_RADIUS_KM, DirectorySort

NEAR_CURSOR_KIND = "near"
NO_RADIUS = "-"  # a near-a-point search that widened past every step: no radius limit


@dataclass(frozen=True)
class SearchFilters:
    city: str | None = None  # ignored when searching near a point
    category_id: int | None = None
    q: str | None = None
    min_rating: float | None = None
    max_price_paise: int | None = None
    home_visit: bool = False  # only artists who travel to the client (a travel radius is set)
    available_on: date | None = None  # only artists with an open slot that IST day
    near: tuple[float, float] | None = None  # (latitude, longitude): adds distances, enables sort=nearest
    radius_km: float | None = None  # with `near`: only artists at most this far; None means no limit
    sort: DirectorySort = DirectorySort.recent

    @property
    def uses_keyset(self) -> bool:
        """The default listing pages by (approved-at, id); every other order pages by position."""
        return self.sort == DirectorySort.recent and self.available_on is None


def encode_near_cursor(radius_km: float | None, inner: str) -> str:
    """Wraps a page cursor with the radius in force, so later pages keep the first page's radius."""
    radius = NO_RADIUS if radius_km is None else repr(radius_km)
    return base64.urlsafe_b64encode(f"{NEAR_CURSOR_KIND}|{radius}|{inner}".encode()).decode()


def decode_near_cursor(cursor: str) -> tuple[float | None, str] | None:
    """(radius, inner cursor) of a near-a-point cursor; None when `cursor` isn't one (e.g. issued before radii)."""
    try:
        kind, radius, inner = base64.urlsafe_b64decode(cursor.encode()).decode().split("|", 2)
    except (ValueError, UnicodeDecodeError):
        return None
    if kind != NEAR_CURSOR_KIND:
        return None
    if radius == NO_RADIUS:
        return None, inner
    try:
        value = float(radius)
    except ValueError as exc:
        raise ValidationError("Invalid cursor") from exc
    if not 0 < value <= MAX_RADIUS_KM:
        raise ValidationError("Invalid cursor")
    return value, inner
