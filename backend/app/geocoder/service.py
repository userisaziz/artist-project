"""Place search through an external geocoder. Best effort by design: any failure (no provider, no key, timeout,
error status, unreadable body) is logged without the key and returns no places, never an error."""

import logging
import time
from typing import Any, Protocol

import httpx

from app.geocoder.config import GeocoderSettings
from app.geocoder.constants import (
    AUTOCOMPLETE_PATH,
    BIAS_DECIMALS,
    CACHE_MAX_ENTRIES,
    CACHE_TTL_SECONDS,
    COUNTRY_FILTER,
    RESULT_LIMIT,
    TIMEOUT_SECONDS,
)
from app.geocoder.schemas import Place

logger = logging.getLogger("art_circle.geocoder")

CacheKey = tuple[str, tuple[float, float] | None]


class Geocoder(Protocol):
    async def search(self, q: str, near: tuple[float, float] | None = None) -> list[Place]: ...


class NoGeocoder:
    """GEOCODER_PROVIDER=none: finds nothing, so area search answers from catalog areas only."""

    async def search(self, q: str, near: tuple[float, float] | None = None) -> list[Place]:
        logger.warning("Geocoder search skipped: GEOCODER_PROVIDER is none")
        return []


def parse_places(body: Any) -> list[Place]:
    """Geoapify's `format=json` results; entries without coordinates are skipped."""
    results = body.get("results") if isinstance(body, dict) else None
    if not isinstance(results, list):
        raise ValueError("geocoder response has no results list")
    places = []
    for r in results:
        if not isinstance(r, dict):
            continue
        lat, lon = r.get("lat"), r.get("lon")
        if not isinstance(lat, int | float) or not isinstance(lon, int | float):
            continue
        label = r.get("formatted") or r.get("address_line1") or r.get("name")
        name = r.get("name") or r.get("address_line1") or label
        if not label or not name:
            continue
        places.append(Place(name=str(name), label=str(label), city=r.get("city"), lat=float(lat), lon=float(lon)))
    return places


class GeoapifyGeocoder:
    """Geoapify autocomplete, limited to India, biased towards the searcher when a point is known. Answers are
    cached in-process for CACHE_TTL_SECONDS by (query, rounded point); failures are not cached."""

    def __init__(self, settings: GeocoderSettings, transport: httpx.AsyncBaseTransport | None = None):
        self.base_url = settings.geocoder_base_url.rstrip("/")
        self.api_key = settings.geocoder_api_key
        self.transport = transport
        self._cache: dict[CacheKey, tuple[float, list[Place]]] = {}

    async def search(self, q: str, near: tuple[float, float] | None = None) -> list[Place]:
        text = q.strip().lower()
        bias = (round(near[0], BIAS_DECIMALS), round(near[1], BIAS_DECIMALS)) if near else None
        key = (text, bias)
        cached = self._cache.get(key)
        if cached and cached[0] > time.monotonic():
            return cached[1]
        if not self.api_key.get_secret_value():
            logger.warning("Geocoder search skipped: GEOCODER_API_KEY is not set")
            return []
        places = await self._fetch(text, bias)
        if places is not None:
            self._remember(key, places)
        return places or []

    async def _fetch(self, text: str, bias: tuple[float, float] | None) -> list[Place] | None:
        params = {
            "text": text,
            "filter": COUNTRY_FILTER,
            "format": "json",
            "limit": str(RESULT_LIMIT),
            "apiKey": self.api_key.get_secret_value(),
        }
        if bias:
            params["bias"] = f"proximity:{bias[1]},{bias[0]}"  # Geoapify takes lon,lat
        try:
            async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS, transport=self.transport) as client:
                response = await client.get(f"{self.base_url}{AUTOCOMPLETE_PATH}", params=params)
            if response.status_code >= 400:
                # Never the URL or the request: both carry the key.
                logger.warning("Geocoder search failed with status %s", response.status_code)
                return None
            return parse_places(response.json())
        except httpx.HTTPError as exc:
            logger.warning("Geocoder search failed: %s", type(exc).__name__)
        except ValueError:  # a body that isn't JSON, or isn't Geoapify's shape
            logger.warning("Geocoder search failed: unreadable response")
        return None

    def _remember(self, key: CacheKey, places: list[Place]) -> None:
        if len(self._cache) >= CACHE_MAX_ENTRIES:
            now = time.monotonic()
            self._cache = {k: v for k, v in self._cache.items() if v[0] > now}
            if len(self._cache) >= CACHE_MAX_ENTRIES:
                self._cache.pop(next(iter(self._cache)))  # the oldest entry
        self._cache[key] = (time.monotonic() + CACHE_TTL_SECONDS, places)
