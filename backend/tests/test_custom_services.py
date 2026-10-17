"""Custom services: approved artists propose their own services; admins approve or reject each one."""

import uuid

import pytest_asyncio
from sqlalchemy import text

from tests.support.artist import complete_profile, submitted_artist
from tests.support.auth import admin_headers as admin
from tests.support.auth import sign_in
from tests.support.catalog import categories, seed_categories

URL = "/api/v1/artists/me/custom-services"


@pytest_asyncio.fixture(autouse=True)
async def catalog_seeded(engine):
    await seed_categories(engine)


async def approved_artist(client, engine, phone: str, admin_headers: dict) -> dict:
    headers = await submitted_artist(client, engine, phone)
    artist_id = (await client.get("/api/v1/artists/me", headers=headers)).json()["id"]
    assert (await client.post(f"/api/v1/admin/artists/{artist_id}/approve", headers=admin_headers)).status_code == 200
    return headers


async def subcategory_id(client, slug: str) -> int:
    tree = (await client.get("/api/v1/categories")).json()
    return next(s["id"] for c in tree for s in c["subcategories"] if s["slug"] == slug)


def custom(sub_id: int, name: str = "Glitter mehendi") -> dict:
    return {"subcategory_id": sub_id, "name": name, "price_paise": 150000, "duration_minutes": 60}


async def test_custom_services_open_after_approval(client, engine):
    headers = await sign_in(client, "+919845040001")
    await complete_profile(client, headers)
    body = custom(await subcategory_id(client, "mehendi-bridal"))
    draft = await client.post(URL, headers=headers, json=body)
    assert (draft.status_code, draft.json()["message"]) == (409, "Custom services open once your profile is approved")
    await client.post("/api/v1/artists/me/submit", headers=headers)
    assert (await client.post(URL, headers=headers, json=body)).status_code == 409


async def test_custom_service_waits_for_review(client, engine):
    admin_headers = await admin(client, engine)
    headers = await approved_artist(client, engine, "+919845040002", admin_headers)
    party = await subcategory_id(client, "makeup-party")  # needn't be under the artist's own categories
    added = await client.post(URL, headers=headers, json=custom(party, " Glitter look "))
    assert added.status_code == 201
    mine = next(s for s in added.json()["services"] if s["template_id"] is None)
    assert (mine["name"], mine["status"], mine["subcategory_id"]) == ("Glitter look", "pending", party)

    top_level = await client.post(URL, headers=headers, json=custom((await categories(client))["mehendi"]))
    assert (top_level.status_code, top_level.json()["message"]) == (422, "Unknown subcategory")
    blank = await client.post(URL, headers=headers, json=custom(party, "   "))
    assert (blank.status_code, blank.json()["message"]) == (422, "Name is required")
    listed = next(s for s in added.json()["services"] if s["template_id"] is not None)
    assert (await client.patch(f"{URL}/{listed['id']}", headers=headers, json={"price_paise": 1})).status_code == 404


async def test_editing_a_custom_service_resubmits_it(client, engine):
    admin_headers = await admin(client, engine)
    headers = await approved_artist(client, engine, "+919845040003", admin_headers)
    other = await approved_artist(client, engine, "+919845040004", admin_headers)
    added = await client.post(URL, headers=headers, json=custom(await subcategory_id(client, "mehendi-bridal")))
    service_id = next(s["id"] for s in added.json()["services"] if s["template_id"] is None)
    async with engine.begin() as conn:
        await conn.execute(
            text("UPDATE artist_services SET status = 'rejected', rejection_reason = 'Too vague' WHERE id = :i"),
            {"i": service_id},
        )

    patched = await client.patch(f"{URL}/{service_id}", headers=headers, json={"price_paise": 160000})
    edited = next(s for s in patched.json()["services"] if s["id"] == service_id)
    assert (edited["status"], edited["rejection_reason"], edited["price_paise"]) == ("pending", None, 160000)

    assert (await client.patch(f"{URL}/{service_id}", headers=other, json={"price_paise": 1})).status_code == 404
    assert (await client.delete(f"{URL}/{uuid.uuid4()}", headers=headers)).status_code == 404
    deleted = await client.delete(f"{URL}/{service_id}", headers=headers)
    assert all(s["id"] != service_id for s in deleted.json()["services"])


QUEUE = "/api/v1/admin/custom-services"


async def test_admin_approves_and_rejects_custom_services(client, engine):
    admin_headers = await admin(client, engine)
    headers = await approved_artist(client, engine, "+919845040010", admin_headers)
    sub = await subcategory_id(client, "mehendi-bridal")
    for name in ("Glitter mehendi", "Neon mehendi"):
        assert (await client.post(URL, headers=headers, json=custom(sub, name))).status_code == 201

    page = (await client.get(f"{QUEUE}?limit=1", headers=admin_headers)).json()
    first = page["items"][0]
    assert first | {"id": None, "artist_id": None, "created_at": None} == {
        "id": None,
        "artist_id": None,
        "created_at": None,
        "business_name": "Ayesha Mehendi Art",
        "category": {"id": (await categories(client))["mehendi"], "name": "Mehendi"},
        "subcategory": {"id": sub, "name": "Bridal"},
        "name": "Glitter mehendi",
        "price_paise": 150000,
        "duration_minutes": 60,
        "description": None,
        "status": "pending",
        "rejection_reason": None,
    }
    second = (await client.get(f"{QUEUE}?limit=1&cursor={page['next_cursor']}", headers=admin_headers)).json()
    assert [i["name"] for i in second["items"]] == ["Neon mehendi"]
    assert second["next_cursor"] is None

    approved = await client.post(f"{QUEUE}/{first['id']}/approve", headers=admin_headers)
    assert approved.json()["status"] == "approved"
    assert (await client.post(f"{QUEUE}/{first['id']}/approve", headers=admin_headers)).status_code == 409
    neon = second["items"][0]["id"]
    assert (await client.post(f"{QUEUE}/{neon}/reject", headers=admin_headers, json={"reason": ""})).status_code == 422
    rejected = await client.post(
        f"{QUEUE}/{neon}/reject", headers=admin_headers, json={"reason": " Too close to Bridal Classic "}
    )
    assert (rejected.json()["status"], rejected.json()["rejection_reason"]) == (
        "rejected",
        "Too close to Bridal Classic",
    )

    mine = (await client.get("/api/v1/artists/me", headers=headers)).json()["services"]
    assert {s["name"]: s["status"] for s in mine} == {
        "Bridal Classic": "approved",
        "Glitter mehendi": "approved",
        "Neon mehendi": "rejected",
    }
    assert (await client.get(QUEUE, headers=admin_headers)).json()["items"] == []
    assert [
        i["name"] for i in (await client.get(f"{QUEUE}?status=rejected", headers=admin_headers)).json()["items"]
    ] == ["Neon mehendi"]

    listed = next(s for s in mine if s["template_id"] is not None)  # services from the admin list aren't in the queue
    assert (await client.post(f"{QUEUE}/{listed['id']}/approve", headers=admin_headers)).status_code == 404
    assert (await client.get(f"{QUEUE}?cursor=garbage", headers=admin_headers)).status_code == 422
