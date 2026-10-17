"""Catalog settings."""

from functools import lru_cache

from app.core.config import AppSettings


class CatalogSettings(AppSettings):
    # Cities an artist can pick; a table replaces this once admins edit it.
    cities: list[str] = ["Bangalore", "Mumbai", "Delhi NCR", "Hyderabad", "Chennai", "Pune"]


@lru_cache
def get_catalog_settings() -> CatalogSettings:
    return CatalogSettings()
