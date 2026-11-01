"""Catalog settings."""

from functools import lru_cache

from app.core.config import AppSettings


class CatalogSettings(AppSettings):
    # Cities an artist can pick; a table replaces this once admins edit it.
    cities: list[str] = ["Bangalore", "Mumbai", "Delhi NCR", "Hyderabad", "Chennai", "Pune"]

    # How long the public tree and a city's areas stay in process memory (see app.catalog.cache).
    # Admin edits drop the cache at commit anyway; this bounds how stale anything else can be.
    cache_ttl_seconds: int = 300


@lru_cache
def get_catalog_settings() -> CatalogSettings:
    return CatalogSettings()
