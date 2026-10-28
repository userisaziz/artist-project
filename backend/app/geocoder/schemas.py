"""What the geocoder returns: a place and its coordinates. Internal; the API maps it to its own contract."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Place:
    name: str  # e.g. "BTM Layout"
    label: str  # the provider's full formatted address
    city: str | None
    lat: float
    lon: float
