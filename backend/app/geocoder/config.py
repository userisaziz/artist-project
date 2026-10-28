"""Geocoder settings: which provider turns a typed place ("BTM Layout") into coordinates."""

from functools import lru_cache
from typing import Literal

from pydantic import SecretStr

from app.core.config import AppSettings


class GeocoderSettings(AppSettings):
    # none: never calls out (area search uses catalog areas only). geoapify: falls back to Geoapify's autocomplete
    # when no catalog area matches; needs GEOCODER_API_KEY, which stays on the server.
    geocoder_provider: Literal["geoapify", "none"] = "none"
    geocoder_base_url: str = "https://api.geoapify.com"
    geocoder_api_key: SecretStr = SecretStr("")


@lru_cache
def get_geocoder_settings() -> GeocoderSettings:
    return GeocoderSettings()
