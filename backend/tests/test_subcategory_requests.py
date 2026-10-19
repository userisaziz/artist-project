"""Subcategory requests: an approved artist suggests a subcategory while adding a custom service; it stays private
to them until an admin approves it (optionally renamed) into the catalog, or rejects it with a reason."""

import pytest_asyncio

from tests.support.artist import submitted_artist
from tests.support.auth import admin_headers as admin
from tests.support.catalog import categories, seed_categories

URL = "/api/v1/artists/me/custom-services"
ADMIN = "/api/v1/admin/subcategory-requests"


@pytest_asyncio.fixture(autouse=True)
async def catalog_seeded(engine):
    await seed_categories(engine)


async def approved_artist(client, engine, phone: str, admin_headers: dict) -> dict:
    headers = await submitted_artist(client, engine, phone)
    artist_id = (await client.get("/api/v1/artists/me", headers=headers)).json()["id"]
    assert (await client.post(f"/api/v1/admin/artists/{artist_id}/approve", headers=admin_headers)).status_code == 200
    return headers


def suggesting(parent_id: int, name: str = "Couple portrait", **service) -> dict:
    return {
        "suggested_subcategory": {"parent_id": parent_id, "name": name, "description": "Portraits of the couple"},
        "name": "Couple portrait session",
        "price_paise": 400000,
        "duration_minutes": 120,
        **service,
    }


def public_names(tree: list[dict]) -> set[str]:
    return {s["name"] for c in tree for s in c["subcategories"]}


async def suggested_service(client, engine) -> tuple[dict, dict, int, dict]:
    admin_headers = await admin(client, engine)
    headers = await approved_artist(client, engine, "+919845050001", admin_headers)
    mehendi = (await categories(client))["mehendi"]
    added = await client.post(URL, headers=headers, json=suggesting(mehendi))
    assert added.status_code == 201, added.text
    service = next(s for s in added.json()["services"] if s["template_id"] is None)
    return admin_headers, headers, mehendi, service


async def test_a_suggested_subcategory_stays_private_until_approved(client, engine):
    admin_headers, _, mehendi, service = await suggested_service(client, engine)

    assert (service["status"], service["subcategory_id"]) == ("pending", mehendi)
    assert (service["suggested_subcategory"]["name"], service["suggested_subcategory"]["status"]) == (
        "Couple portrait",
        "pending",
    )
    assert "Couple portrait" not in public_names((await client.get("/api/v1/categories")).json())

    queue = (await client.get(f"{ADMIN}?status=pending", headers=admin_headers)).json()["items"]
    assert [(r["name"], r["parent"]["name"], r["services_waiting"]) for r in queue] == [
        ("Couple portrait", "Mehendi", 1)
    ]
    assert queue[0]["artist"]["business_name"]
    # Its service can't be approved while the subcategory is undecided.
    blocked = await client.post(f"/api/v1/admin/custom-services/{service['id']}/approve", headers=admin_headers)
    assert blocked.status_code == 409


async def test_approving_renames_and_moves_the_waiting_service(client, engine):
    admin_headers, headers, mehendi, service = await suggested_service(client, engine)
    request_id = service["suggested_subcategory"]["id"]

    approved = await client.post(
        f"{ADMIN}/{request_id}/approve", headers=admin_headers, json={"name": "Couple portraits"}
    )

    assert approved.status_code == 200, approved.text
    body = approved.json()
    assert (body["status"], body["name"]) == ("approved", "Couple portraits")
    tree = (await client.get("/api/v1/categories")).json()
    sub = next(s for c in tree if c["id"] == mehendi for s in c["subcategories"] if s["name"] == "Couple portraits")
    assert body["subcategory_id"] == sub["id"]
    mine = next(
        s
        for s in (await client.get("/api/v1/artists/me", headers=headers)).json()["services"]
        if s["id"] == service["id"]
    )
    assert (mine["subcategory_id"], mine["status"], mine["suggested_subcategory"]["status"]) == (
        sub["id"],
        "pending",
        "approved",
    )
    assert (
        await client.post(f"/api/v1/admin/custom-services/{service['id']}/approve", headers=admin_headers)
    ).status_code == 200
    assert (
        await client.post(f"{ADMIN}/{request_id}/reject", headers=admin_headers, json={"reason": "x"})
    ).status_code == 409


async def test_rejecting_sends_the_service_back_to_pick_an_existing_subcategory(client, engine):
    admin_headers, headers, _, service = await suggested_service(client, engine)
    request_id = service["suggested_subcategory"]["id"]

    rejected = await client.post(f"{ADMIN}/{request_id}/reject", headers=admin_headers, json={"reason": "Use Bridal"})

    assert (rejected.status_code, rejected.json()["status"]) == (200, "rejected")
    mine = next(
        s
        for s in (await client.get("/api/v1/artists/me", headers=headers)).json()["services"]
        if s["id"] == service["id"]
    )
    assert mine["status"] == "rejected"
    assert "Use Bridal" in mine["rejection_reason"]
    bridal = next(
        s["id"]
        for c in (await client.get("/api/v1/categories")).json()
        for s in c["subcategories"]
        if s["slug"] == "mehendi-bridal"
    )
    moved = await client.patch(f"{URL}/{service['id']}", headers=headers, json={"subcategory_id": bridal})
    again = next(s for s in moved.json()["services"] if s["id"] == service["id"])
    assert (again["status"], again["subcategory_id"], again["suggested_subcategory"]) == ("pending", bridal, None)


async def test_suggestions_are_validated(client, engine):
    admin_headers = await admin(client, engine)
    headers = await approved_artist(client, engine, "+919845050002", admin_headers)
    cats = await categories(client)

    both = suggesting(cats["mehendi"], subcategory_id=cats["mehendi"])
    assert (await client.post(URL, headers=headers, json=both)).status_code == 422
    neither = {"name": "X", "price_paise": 100, "duration_minutes": 30}
    assert (await client.post(URL, headers=headers, json=neither)).status_code == 422
    existing = await client.post(URL, headers=headers, json=suggesting(cats["mehendi"], name="bridal"))
    assert existing.status_code == 422
    assert "already" in existing.json()["message"]
    unknown = await client.post(URL, headers=headers, json=suggesting(999_999))
    assert (unknown.status_code, unknown.json()["message"]) == (422, "Unknown category")


async def test_summary_and_admin_only(client, engine):
    admin_headers, headers, _, _ = await suggested_service(client, engine)

    summary = (await client.get(f"{ADMIN}/summary", headers=admin_headers)).json()

    assert summary["counts"] == {"pending": 1, "approved": 0, "rejected": 0}
    assert summary["approved_30d"] == 0
    assert summary["admin_defaults"] >= 2  # the seeded active subcategories
    assert summary["oldest_pending_at"] is not None
    assert (await client.get(ADMIN, headers=headers)).status_code == 403
