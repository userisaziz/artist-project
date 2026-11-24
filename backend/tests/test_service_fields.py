"""Per-category service rules: admins give a category a fulfilment and fields; artists answer the listing fields;
customers answer the booking fields; made-to-order services are quoted, not booked; per-person services are priced
per guest."""

import pytest_asyncio

from tests.support.booking import book, setup
from tests.support.catalog import seed_categories
from tests.support.directory import ist_day

CATEGORIES = "/api/v1/admin/categories"


@pytest_asyncio.fixture(autouse=True)
async def categories_seeded(engine):
    await seed_categories(engine)


async def ids(client) -> tuple[int, int]:
    """(Mehendi, Mehendi › Bridal), the category the canonical artist's service is filed under."""
    tree = (await client.get("/api/v1/categories")).json()
    mehendi = next(c for c in tree if c["slug"] == "mehendi")
    return mehendi["id"], next(s["id"] for s in mehendi["subcategories"] if s["slug"] == "mehendi-bridal")


OCCASION = {"key": "occasion", "label": "Occasion", "scope": "booking", "type": "select", "options": ["Wedding", "Eid"]}
HANDS = {"key": "coverage", "label": "Coverage", "scope": "listing", "type": "select", "options": ["Wrists", "Elbows"]}
NAME = {"key": "bride_name", "label": "Bride's name", "scope": "booking", "type": "text", "required": True}
CONES = {
    "key": "cones",
    "label": "Cones used",
    "scope": "listing",
    "type": "number",
    "min": 1,
    "max": 50,
    "unit": "cones",
}


async def test_admins_set_fields_and_subcategories_inherit_them(client, engine):
    admin, _, _ = await setup(client, engine)
    parent, sub = await ids(client)

    saved = await client.patch(f"{CATEGORIES}/{parent}", headers=admin, json={"field_schema": [OCCASION, HANDS]})
    assert saved.status_code == 200, saved.text
    assert [f["key"] for f in saved.json()["field_schema"]] == ["occasion", "coverage"]
    own = await client.patch(
        f"{CATEGORIES}/{sub}", headers=admin, json={"field_schema": [NAME, CONES], "fulfilment": "appointment"}
    )
    assert own.status_code == 200, own.text

    tree = (await client.get("/api/v1/categories")).json()
    bridal = next(s for c in tree for s in c["subcategories"] if s["id"] == sub)
    assert [f["key"] for f in bridal["fields"]] == ["occasion", "coverage", "bride_name", "cones"]  # parent first
    assert bridal["fulfilment"] == "appointment"

    clash = await client.patch(f"{CATEGORIES}/{sub}", headers=admin, json={"field_schema": [OCCASION]})
    assert clash.status_code == 422  # a key the parent already uses
    no_options = {**OCCASION, "key": "mood", "options": []}
    assert (
        await client.patch(f"{CATEGORIES}/{sub}", headers=admin, json={"field_schema": [no_options]})
    ).status_code == 422


async def test_listing_details_are_validated_and_shown_with_the_booking_questions(client, engine):
    admin, artist, _ = await setup(client, engine)
    _, sub = await ids(client)
    await client.patch(f"{CATEGORIES}/{sub}", headers=admin, json={"field_schema": [HANDS, CONES, NAME]})
    url = f"/api/v1/artists/me/services/{artist['service_id']}"

    bad = await client.patch(url, headers=artist["headers"], json={"attributes": {"coverage": "Shoulders"}})
    assert bad.status_code == 422
    unknown = await client.patch(url, headers=artist["headers"], json={"attributes": {"colour": "red"}})
    assert unknown.status_code == 422
    ok = await client.patch(url, headers=artist["headers"], json={"attributes": {"coverage": "Elbows", "cones": 6}})
    assert ok.status_code == 200, ok.text  # live for an approved artist, no new review
    assert ok.json()["status"] == "approved"

    service = (await client.get(f"/api/v1/artists/{artist['id']}")).json()["services"][0]
    assert service["details"] == [
        {"key": "coverage", "label": "Coverage", "value": "Elbows", "unit": None},
        {"key": "cones", "label": "Cones used", "value": 6, "unit": "cones"},
    ]
    assert [f["key"] for f in service["booking_fields"]] == ["bride_name"]
    assert (service["fulfilment"], service["pricing_unit"]) == ("appointment", "package")


async def test_bookings_keep_the_answers_as_asked(client, engine):
    admin, artist, customer = await setup(client, engine)
    _, sub = await ids(client)
    await client.patch(f"{CATEGORIES}/{sub}", headers=admin, json={"field_schema": [NAME, OCCASION]})

    missing = await book(client, customer, artist, answers={"occasion": "Eid"})
    assert missing.status_code == 422
    assert missing.json()["message"] == "“Bride's name” is required"
    made = await book(client, customer, artist, answers={"bride_name": " Sara ", "occasion": "Wedding"})
    assert made.status_code == 201, made.text
    assert made.json()["answers"] == [
        {"key": "bride_name", "label": "Bride's name", "value": "Sara", "unit": None},
        {"key": "occasion", "label": "Occasion", "value": "Wedding", "unit": None},
    ]

    renamed = {**NAME, "label": "Name on the design"}
    await client.patch(f"{CATEGORIES}/{sub}", headers=admin, json={"field_schema": [renamed]})
    shown = (await client.get(f"/api/v1/bookings/{made.json()['id']}", headers=customer)).json()
    assert shown["answers"][0]["label"] == "Bride's name"  # history keeps the question as it was asked


async def test_per_person_services_are_priced_per_guest(client, engine):
    _, artist, customer = await setup(client, engine)
    url = f"/api/v1/artists/me/services/{artist['service_id']}"
    assert (await book(client, customer, artist, quantity=3)).status_code == 422  # a package has no guests

    await client.patch(url, headers=artist["headers"], json={"pricing_unit": "per_person", "price_paise": 80000})
    made = await book(client, customer, artist, quantity=4)
    assert made.status_code == 201, made.text
    assert (made.json()["quantity"], made.json()["subtotal_paise"]) == (4, 320000)


async def test_made_to_order_services_are_quoted_not_booked(client, engine):
    admin, artist, customer = await setup(client, engine)
    parent, _ = await ids(client)
    box_name = {"key": "baby_name", "label": "Baby's name", "scope": "booking", "type": "text", "required": True}
    await client.patch(f"{CATEGORIES}/{parent}", headers=admin, json={"fulfilment": "made_to_order"})
    _, sub = await ids(client)
    await client.patch(f"{CATEGORIES}/{sub}", headers=admin, json={"field_schema": [box_name]})

    service = (await client.get(f"/api/v1/artists/{artist['id']}")).json()["services"][0]
    assert service["fulfilment"] == "made_to_order"  # inherited from the parent
    refused = await book(client, customer, artist, answers={"baby_name": "Ayaan"})
    assert refused.status_code == 409

    body = {
        "artist_id": artist["id"],
        "event_date": ist_day(10).isoformat(),
        "details": "Aqiqah sweet boxes for the family dinner, pastel theme please.",
        "service_id": artist["service_id"],
        "quantity": 40,
    }
    assert (await client.post("/api/v1/enquiries", headers=customer, json=body)).status_code == 422  # name missing
    asked = await client.post("/api/v1/enquiries", headers=customer, json={**body, "answers": {"baby_name": "Ayaan"}})
    assert asked.status_code == 201, asked.text
    e = asked.json()
    assert (e["service_name"], e["quantity"]) == ("Bridal Classic", 40)
    assert e["answers"] == [{"key": "baby_name", "label": "Baby's name", "value": "Ayaan", "unit": None}]

    theirs = (await client.get("/api/v1/artists/me/enquiries", headers=artist["headers"])).json()["items"]
    assert [(x["service_name"], x["answers"][0]["value"]) for x in theirs] == [("Bridal Classic", "Ayaan")]
