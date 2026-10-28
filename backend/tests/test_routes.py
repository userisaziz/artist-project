"""Route contract, checked over every registered endpoint so a new route can't skip it:
documented (summary, explicit status, response model), admin routes guarded and audited,
and nothing outside a short public list reachable without signing in."""

import logging

import pytest
from fastapi.dependencies.models import Dependant
from fastapi.routing import APIRoute

from app.booking.dependencies import booking_requests_per_user
from app.core.auth import audited_admin, get_current_user
from app.core.rate_limit import Limit
from app.main import create_app
from tests.support.auth import admin_headers
from tests.support.booking import book, setup
from tests.support.catalog import seed_categories

# Reachable without a token: sign-in itself, health probes, and the public catalog and directory.
PUBLIC = {
    "/health",
    "/health/live",
    "/health/ready",
    "/auth/otp/request",
    "/auth/otp/verify",
    "/auth/refresh",
    "/auth/logout",
    "/categories",
    "/cities",
    "/areas",
    "/areas/nearest",
    "/areas/search",
    "/artists",
    "/artists/{artist_id}",
    "/artists/{artist_id}/availability",
    "/artists/{artist_id}/reviews",
    "/metrics",  # for the scraper: guarded by METRICS_TOKEN instead of a user session
}


def _walk(routes):
    for route in routes:
        if isinstance(route, APIRoute):
            yield route
        elif hasattr(route, "original_router"):  # FastAPI keeps included routers as wrappers
            yield from _walk(route.original_router.routes)


def _calls(dependant: Dependant):
    yield dependant.call
    for sub in dependant.dependencies:
        yield from _calls(sub)


ROUTES = list(_walk(create_app().routes))


def _id(route: APIRoute) -> str:
    return f"{','.join(sorted(route.methods))} {route.path}"


def test_the_route_table_is_not_empty():
    assert len(ROUTES) > 50


@pytest.mark.parametrize("route", ROUTES, ids=_id)
def test_every_route_is_documented(route: APIRoute):
    assert route.summary, "summary= is required"
    assert route.status_code is not None, "status_code= must be explicit"
    assert route.tags, "the router must set tags"
    if route.status_code != 204 and route.include_in_schema:  # /metrics answers Prometheus text, not JSON
        assert route.response_model is not None, "response_model= is required"


@pytest.mark.parametrize("route", [r for r in ROUTES if r.path.startswith("/admin")], ids=_id)
def test_admin_routes_are_guarded_and_audited(route: APIRoute):
    assert audited_admin in set(_calls(route.dependant))


@pytest.mark.parametrize("route", [r for r in ROUTES if r.path not in PUBLIC], ids=_id)
def test_non_public_routes_require_a_signed_in_user(route: APIRoute):
    assert get_current_user in set(_calls(route.dependant))


async def test_admin_changes_are_audited(client, engine, caplog):
    await seed_categories(engine)
    admin = await admin_headers(client, engine)
    caplog.set_level(logging.INFO, logger="art_circle.audit")
    created = await client.post("/api/v1/admin/categories", headers=admin, json={"name": "Nail Art"})
    assert created.status_code == 201
    await client.get("/api/v1/admin/categories", headers=admin)  # reads are not audited
    actions = [r for r in caplog.records if getattr(r, "event", None) == "admin.action"]
    assert [(r.method, r.path) for r in actions] == [("POST", "/api/v1/admin/categories")]


async def test_booking_requests_are_limited_per_user(client, engine, override):
    await seed_categories(engine)
    override(booking_requests_per_user, lambda: Limit(hits=1, window_seconds=3600))
    _, artist, customer = await setup(client, engine)
    assert (await book(client, customer, artist)).status_code == 201
    second = await book(client, customer, artist)
    assert (second.status_code, second.json()["code"]) == (429, "rate_limited")
