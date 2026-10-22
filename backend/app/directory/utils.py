"""Explore search filters, built from the query string by `dependencies.search_filters`."""

from dataclasses import dataclass
from datetime import date

from app.directory.constants import DirectorySort


@dataclass(frozen=True)
class SearchFilters:
    city: str | None = None
    category_id: int | None = None
    q: str | None = None
    min_rating: float | None = None
    max_price_paise: int | None = None
    home_visit: bool = False  # only artists who travel to the client (a travel radius is set)
    available_on: date | None = None  # only artists with an open slot that IST day
    near: tuple[float, float] | None = None  # (latitude, longitude): adds distances, enables sort=nearest
    sort: DirectorySort = DirectorySort.recent

    @property
    def uses_keyset(self) -> bool:
        """The default listing pages by (approved-at, id); every other order pages by position."""
        return self.sort == DirectorySort.recent and self.available_on is None
