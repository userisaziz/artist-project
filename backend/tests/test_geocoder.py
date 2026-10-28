"""The Geoapify client: what it asks for, what it parses, its cache, and that every failure is an empty answer."""

import logging

import httpx
import pytest

from app.core.logging import configure_logging
from app.geocoder.config import GeocoderSettings
from app.geocoder.service import GeoapifyGeocoder, NoGeocoder

KEY = "test-key-never-logged"

RESULTS = {
    "results": [
        {
            "name": "BTM Layout",
            "formatted": "BTM Layout, Bengaluru, Karnataka, India",
            "city": "Bengaluru",
            "lat": 12.9166,
            "lon": 77.6101,
        },
        {"formatted": "No coordinates, India"},  # skipped
        {"address_line1": "HSR Layout", "formatted": "HSR Layout, Bengaluru", "lat": 12.91, "lon": 77.64},
    ]
}


def geocoder(handler, key: str = KEY) -> GeoapifyGeocoder:
    settings = GeocoderSettings(
        geocoder_provider="geoapify", geocoder_base_url="https://geo.test", geocoder_api_key=key
    )
    return GeoapifyGeocoder(settings, transport=httpx.MockTransport(handler))


async def test_searches_india_biased_to_the_point_and_parses_places():
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(200, json=RESULTS)

    places = await geocoder(handler).search("  BTM Layout ", (12.93456, 77.62345))

    assert [(p.name, p.label, p.city, p.lat, p.lon) for p in places] == [
        ("BTM Layout", "BTM Layout, Bengaluru, Karnataka, India", "Bengaluru", 12.9166, 77.6101),
        ("HSR Layout", "HSR Layout, Bengaluru", None, 12.91, 77.64),
    ]
    (request,) = requests
    assert request.url.path == "/v1/geocode/autocomplete"
    assert dict(request.url.params) == {
        "text": "btm layout",
        "filter": "countrycode:in",
        "format": "json",
        "limit": "10",
        "apiKey": KEY,
        "bias": "proximity:77.62,12.93",  # lon,lat, rounded so nearby searchers share the cache
    }


async def test_answers_are_cached_by_query_and_rounded_point():
    calls = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return httpx.Response(200, json=RESULTS)

    client = geocoder(handler)
    await client.search("BTM layout", (12.931, 77.621))
    await client.search(" btm LAYOUT", (12.932, 77.622))  # same query, same rounded point
    assert calls == 1
    await client.search("btm layout")  # no point: a different entry
    assert calls == 2


def failing(status: int | None = None, body: bytes = b"", error: Exception | None = None):
    def handler(request: httpx.Request) -> httpx.Response:
        if error:
            raise error
        return httpx.Response(status or 200, content=body)

    return handler


@pytest.mark.parametrize(
    "handler",
    [
        failing(error=httpx.ReadTimeout("timed out")),
        failing(error=httpx.ConnectError("refused")),
        failing(status=401, body=b'{"error": "Unauthorized"}'),
        failing(status=500),
        failing(body=b"<html>not json</html>"),
        failing(body=b'{"features": []}'),  # not the json format's shape
    ],
    ids=["timeout", "unreachable", "401", "500", "not-json", "wrong-shape"],
)
async def test_any_failure_is_an_empty_answer_and_never_logs_the_key(handler, caplog):
    with caplog.at_level(logging.DEBUG):
        places = await geocoder(handler).search("btm layout")

    assert places == []
    assert "Geocoder search failed" in caplog.text
    assert KEY not in caplog.text


async def test_failures_are_not_cached():
    responses = iter([httpx.Response(500), httpx.Response(200, json=RESULTS)])
    client = geocoder(lambda request: next(responses))

    assert await client.search("btm layout") == []
    assert len(await client.search("btm layout")) == 2


async def test_without_a_key_or_a_provider_nothing_is_called():
    def handler(request: httpx.Request) -> httpx.Response:
        raise AssertionError("the geocoder must not be called")

    assert await geocoder(handler, key="").search("btm layout") == []
    assert await NoGeocoder().search("btm layout") == []


def test_app_logging_keeps_httpx_request_urls_and_their_key_out_of_the_logs():
    """httpx logs each request URL at INFO, and Geoapify takes its key in the query string."""
    root, httpx_logger = logging.getLogger(), logging.getLogger("httpx")
    saved = (root.handlers[:], root.level, httpx_logger.level)
    try:
        configure_logging("DEBUG", json_lines=False)
        assert not httpx_logger.isEnabledFor(logging.INFO)
        assert httpx_logger.isEnabledFor(logging.WARNING)
    finally:
        root.handlers[:], root.level = saved[0], saved[1]
        httpx_logger.setLevel(saved[2])
