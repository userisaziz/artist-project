from functools import lru_cache

from app.geocoder.config import get_geocoder_settings
from app.geocoder.service import GeoapifyGeocoder, Geocoder, NoGeocoder


@lru_cache
def get_geocoder() -> Geocoder:
    """One geocoder per process, so its cache is shared across requests."""
    settings = get_geocoder_settings()
    if settings.geocoder_provider == "geoapify":
        return GeoapifyGeocoder(settings)
    return NoGeocoder()
