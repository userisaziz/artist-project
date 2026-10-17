"""Booking support: the canonical admin/approved-artist/customer trio and the book flow."""

from datetime import datetime, timedelta

from tests.support.artist import approved_artist
from tests.support.auth import CUSTOMER_PHONE, admin_headers, sign_in
from tests.support.directory import slot


def at(when: str, hours: float = 0):
    """A frozen clock `hours` after `when`."""
    moment = datetime.fromisoformat(when) + timedelta(hours=hours)
    return lambda: moment


async def book(client, customer: dict, artist: dict, start: str | None = None, **extra):
    return await client.post(
        "/api/v1/bookings",
        headers=customer,
        json={
            "artist_id": artist["id"],
            "service_id": artist["service_id"],
            "start_at": start or slot(),
            "address": "12 1st Block, Koramangala",
            **extra,
        },
    )


async def setup(client, engine) -> tuple[dict, dict, dict]:
    admin = await admin_headers(client, engine)
    artist = await approved_artist(client, engine, "+919845091001", admin)
    customer = await sign_in(client, CUSTOMER_PHONE, role="customer")
    return admin, artist, customer
