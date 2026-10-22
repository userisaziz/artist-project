"""Service extras: what a service includes, and priced add-ons a customer can pick when booking.
Picked add-ons are copied onto the booking (name and price at the time) and counted in its total."""

import pytest_asyncio

from tests.support.artist import approved_artist
from tests.support.auth import CUSTOMER_PHONE, admin_headers, sign_in
from tests.support.booking import book
from tests.support.catalog import categories, seed_categories, templates

ARTIST_PHONE = "+919845077701"
INCLUDED = ["Bridal hands", "Bridal feet", "Custom design"]
ADDONS = [
    {"name": "Guest mehendi", "price_paise": 50000, "per_person": True},
    {"name": "Organic henna upgrade", "price_paise": 40000, "per_person": False},
]


@pytest_asyncio.fixture(autouse=True)
async def categories_seeded(engine):
    await seed_categories(engine)


async def extras_artist(client, engine) -> tuple[dict, dict]:
    admin = await admin_headers(client, engine)
    artist = await approved_artist(
        client, engine, ARTIST_PHONE, admin, service={"included_items": INCLUDED, "addons": ADDONS}
    )
    customer = await sign_in(client, CUSTOMER_PHONE, role="customer")
    return artist, customer


def addon_ids(artist: dict) -> dict[str, str]:
    return {a["name"]: a["id"] for a in artist["service"]["addons"]}


# --- the artist's service ----------------------------------------------------------------------------


async def test_a_service_keeps_its_included_items_and_addons_in_order(client, engine):
    artist, _ = await extras_artist(client, engine)
    service = artist["service"]
    assert service["included_items"] == INCLUDED
    assert [{k: a[k] for k in ("name", "price_paise", "per_person")} for a in service["addons"]] == ADDONS
    assert all(a["id"] for a in service["addons"])


async def test_editing_a_service_replaces_its_extras(client, engine):
    headers = await sign_in(client, ARTIST_PHONE)
    cats, tpl = await categories(client), await templates(client)
    await client.put(
        "/api/v1/artists/me/profile",
        headers=headers,
        json={"business_name": "A", "city": "Pune", "category_ids": [cats["makeup"]]},
    )
    added = await client.post(
        "/api/v1/artists/me/services",
        headers=headers,
        json={"template_id": tpl["Party Makeup"], "price_paise": 300000, "duration_minutes": 90, "addons": ADDONS},
    )
    service = added.json()["services"][0]
    assert service["included_items"] == []

    patched = await client.patch(
        f"/api/v1/artists/me/services/{service['id']}",
        headers=headers,
        json={"included_items": ["Lashes"], "addons": [{"name": "Hair styling", "price_paise": 150000}]},
    )
    after = patched.json()["services"][0]
    assert after["included_items"] == ["Lashes"]
    assert [(a["name"], a["per_person"]) for a in after["addons"]] == [("Hair styling", False)]

    untouched = await client.patch(
        f"/api/v1/artists/me/services/{service['id']}", headers=headers, json={"price_paise": 320000}
    )
    assert untouched.json()["services"][0]["included_items"] == ["Lashes"]  # omitted lists are left as they are
    assert len(untouched.json()["services"][0]["addons"]) == 1


async def test_extras_are_validated(client, engine):
    headers = await sign_in(client, ARTIST_PHONE)
    cats, tpl = await categories(client), await templates(client)
    await client.put(
        "/api/v1/artists/me/profile",
        headers=headers,
        json={"business_name": "A", "city": "Pune", "category_ids": [cats["makeup"]]},
    )
    base = {"template_id": tpl["Party Makeup"], "price_paise": 300000, "duration_minutes": 90}
    for extra in (
        {"addons": [{"name": "Free", "price_paise": 0}]},
        {"addons": [{"name": " ", "price_paise": 100}]},
        {"included_items": [""]},
        {"included_items": [f"Item {i}" for i in range(9)]},
    ):
        response = await client.post("/api/v1/artists/me/services", headers=headers, json={**base, **extra})
        assert response.status_code == 422, extra


async def test_the_storefront_shows_included_items_and_addons(client, engine):
    artist, _ = await extras_artist(client, engine)
    storefront = (await client.get(f"/api/v1/artists/{artist['id']}")).json()
    service = storefront["services"][0]
    assert service["included_items"] == INCLUDED
    assert [(a["name"], a["price_paise"], a["per_person"]) for a in service["addons"]] == [
        (a["name"], a["price_paise"], a["per_person"]) for a in ADDONS
    ]


# --- booking with add-ons ----------------------------------------------------------------------------


async def test_picked_addons_are_priced_and_copied_onto_the_booking(client, engine):
    artist, customer = await extras_artist(client, engine)
    ids = addon_ids(artist)
    response = await book(
        client,
        customer,
        artist,
        addons=[{"addon_id": ids["Guest mehendi"], "guests": 4}, {"addon_id": ids["Organic henna upgrade"]}],
    )
    assert response.status_code == 201
    b = response.json()
    # ₹5,500 service + 4 x ₹500 guests + ₹400 upgrade = ₹7,900; + ₹99 fee = ₹7,999.
    assert b["subtotal_paise"] == 790000
    assert b["total_paise"] == 799900
    assert b["addons"] == [
        {"name": "Guest mehendi", "unit_price_paise": 50000, "per_person": True, "guests": 4, "line_paise": 200000},
        {
            "name": "Organic henna upgrade",
            "unit_price_paise": 40000,
            "per_person": False,
            "guests": 1,
            "line_paise": 40000,
        },
    ]
    again = (await client.get(f"/api/v1/bookings/{b['id']}", headers=customer)).json()
    assert again["addons"] == b["addons"]
    artist_copy = (await client.get(f"/api/v1/artists/me/bookings/{b['id']}", headers=artist["headers"])).json()
    assert artist_copy["addons"] == b["addons"]


async def test_a_booking_without_addons_is_priced_as_before(client, engine):
    artist, customer = await extras_artist(client, engine)
    b = (await book(client, customer, artist)).json()
    assert b["subtotal_paise"] == 550000
    assert b["addons"] == []


async def test_bad_addon_picks_are_refused(client, engine):
    artist, customer = await extras_artist(client, engine)
    ids = addon_ids(artist)
    for addons in (
        [{"addon_id": "00000000-0000-0000-0000-000000000000"}],  # not on this service
        [{"addon_id": ids["Guest mehendi"]}, {"addon_id": ids["Guest mehendi"]}],  # twice
        [{"addon_id": ids["Organic henna upgrade"], "guests": 3}],  # guests only for per-person add-ons
        [{"addon_id": ids["Guest mehendi"], "guests": 0}],
    ):
        response = await book(client, customer, artist, addons=addons)
        assert response.status_code == 422, addons
