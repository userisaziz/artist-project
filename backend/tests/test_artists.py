"""Artist onboarding contract: build the profile, add services and photos, then submit for review."""

import uuid

import pytest_asyncio
from sqlalchemy import text

from app.modules.uploads.storage import FakeStorage
from app.modules.auth.sms import ConsoleSMSProvider

ARTIST_PHONE = "+919845011111"
CATEGORIES = [("mehendi", "Mehendi"), ("makeup", "Makeup"), ("hair", "Hair"),
              ("photography", "Photography"), ("decor", "Decor"), ("tattoo", "Tattoo")]


async def seed_categories(engine) -> None:
    """Admins build the catalog in the admin app; tests insert the design's six categories directly,
    plus Mehendi › Bridal and Makeup › Party with a few services so onboarding has something to pick."""
    async with engine.begin() as conn:
        ids = {}
        for i, (slug, name) in enumerate(CATEGORIES):
            ids[slug] = (await conn.execute(
                text("INSERT INTO categories (slug, name, sort_order, status) VALUES (:s, :n, :i, 'active') RETURNING id"),
                {"s": slug, "n": name, "i": i},
            )).scalar_one()
        for parent, slug, name, services in (("mehendi", "mehendi-bridal", "Bridal", ("Bridal Classic", "Bridal Full Arms")),
                                             ("makeup", "makeup-party", "Party", ("Party Makeup",))):
            sub = (await conn.execute(
                text("INSERT INTO categories (slug, name, sort_order, parent_id, status) VALUES (:s, :n, 0, :p, 'active') RETURNING id"),
                {"s": slug, "n": name, "p": ids[parent]},
            )).scalar_one()
            for i, service in enumerate(services):
                await conn.execute(text("INSERT INTO service_templates (subcategory_id, name, sort_order) VALUES (:s, :n, :i)"),
                                   {"s": sub, "n": service, "i": i})


@pytest_asyncio.fixture(autouse=True)
async def categories_seeded(engine):
    await seed_categories(engine)


async def sign_in(client, phone: str, role: str | None = "artist", engine=None) -> dict:
    """Phone + OTP, then optionally pick a role (artist/customer) or force admin straight in the DB."""
    await client.post("/api/v1/auth/otp/request", json={"phone": phone})
    code = ConsoleSMSProvider.sent[-1][1].split()[-1]
    body = (await client.post("/api/v1/auth/otp/verify", json={"phone": phone, "code": code})).json()
    headers = {"Authorization": f"Bearer {body['access_token']}"}
    if role in ("artist", "customer"):
        await client.put("/api/v1/users/me/role", headers=headers, json={"role": role})
    elif role == "admin":
        async with engine.begin() as conn:
            await conn.execute(text("INSERT INTO user_roles (user_id, role) SELECT id, 'admin' FROM users WHERE phone=:p"), {"p": phone})
    return headers


async def categories(client) -> dict[str, int]:
    return {c["slug"]: c["id"] for c in (await client.get("/api/v1/categories")).json()}


async def templates(client) -> dict[str, int]:
    """Service name → template id, from the public catalog tree."""
    tree = (await client.get("/api/v1/categories")).json()
    return {s["name"]: s["id"] for c in tree for sub in c["subcategories"] for s in sub["services"]}


async def upload_key(client, headers, purpose: str) -> str:
    response = await client.post("/api/v1/uploads/signature", headers=headers, json={"purpose": purpose})
    assert response.status_code == 200
    return response.json()["key"]


async def add_kyc(client, headers) -> None:
    """Identity step with a generated (not real) Aadhaar number."""
    response = await client.put("/api/v1/artists/me/kyc", headers=headers, json={
        "aadhaar_number": "234123412346",
        "front_key": await upload_key(client, headers, "aadhaar"),
        "back_key": await upload_key(client, headers, "aadhaar"),
    })
    assert response.status_code == 200


async def complete_profile(client, headers, photos: int = 6, kyc: bool = True) -> dict:
    """A submittable profile: photo, name, category, city, one service, `photos` portfolio photos."""
    cats = await categories(client)
    await client.put("/api/v1/artists/me/profile", headers=headers, json={
        "business_name": "Ayesha Mehendi Art", "city": "Bangalore",
        "category_ids": [cats["mehendi"]], "photo_key": await upload_key(client, headers, "artist_photo"),
    })
    await client.post("/api/v1/artists/me/services", headers=headers, json={
        "template_id": (await templates(client))["Bridal Classic"], "price_paise": 550000, "duration_minutes": 180,
    })
    for _ in range(photos):
        key = await upload_key(client, headers, "portfolio")
        await client.post("/api/v1/artists/me/photos", headers=headers, json={"key": key, "width": 1200, "height": 1500})
    if kyc:
        await add_kyc(client, headers)
    return (await client.get("/api/v1/artists/me", headers=headers)).json()


async def test_categories_and_cities_are_public(client):
    cats = (await client.get("/api/v1/categories")).json()
    assert [c["slug"] for c in cats] == ["mehendi", "makeup", "hair", "photography", "decor", "tattoo"]
    assert "Bangalore" in (await client.get("/api/v1/cities")).json()


async def test_customer_cannot_use_artist_endpoints(client):
    headers = await sign_in(client, "+919845022222", role="customer")
    assert (await client.get("/api/v1/artists/me", headers=headers)).status_code == 403
    response = await client.post("/api/v1/uploads/signature", headers=headers, json={"purpose": "portfolio"})
    assert response.status_code == 403
    assert response.json()["code"] == "forbidden"


async def test_no_profile_until_first_save(client):
    headers = await sign_in(client, ARTIST_PHONE)
    response = await client.get("/api/v1/artists/me", headers=headers)
    assert response.status_code == 404
    assert response.json()["code"] == "not_found"


async def test_save_profile_creates_a_draft_and_returns_urls(client):
    headers = await sign_in(client, ARTIST_PHONE)
    cats = await categories(client)
    photo_key = await upload_key(client, headers, "artist_photo")
    response = await client.put("/api/v1/artists/me/profile", headers=headers, json={
        "business_name": "  Ayesha Mehendi Art ", "city": "Bangalore",
        "category_ids": [cats["makeup"], cats["mehendi"]], "photo_key": photo_key,
    })
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "draft"
    assert body["business_name"] == "Ayesha Mehendi Art"
    assert [c["slug"] for c in body["categories"]] == ["mehendi", "makeup"]  # category order, not request order
    assert body["photo_url"] == f"https://fake.storage/thumb/{photo_key}.jpg"
    assert (await client.get("/api/v1/artists/me", headers=headers)).json()["id"] == body["id"]


async def test_profile_rejects_unknown_city_category_and_foreign_keys(client):
    headers = await sign_in(client, ARTIST_PHONE)
    cats = await categories(client)
    base = {"business_name": "A", "city": "Bangalore", "category_ids": [cats["mehendi"]]}
    for patch in ({"city": "Atlantis"}, {"category_ids": [9999]},
                  {"photo_key": f"artists/{uuid.uuid4()}/artist_photo/{'a' * 20}"},  # someone else's folder
                  {"photo_key": await upload_key(client, headers, "portfolio")}):    # wrong purpose
        response = await client.put("/api/v1/artists/me/profile", headers=headers, json={**base, **patch})
        assert response.status_code == 422, patch
        assert response.json()["code"] == "validation_error"


async def test_profile_accepts_top_level_categories_only(client, engine):
    headers = await sign_in(client, ARTIST_PHONE)
    cats = await categories(client)
    async with engine.begin() as conn:
        sub_id = (await conn.execute(text(
            "INSERT INTO categories (slug, name, sort_order, parent_id, status) VALUES ('mehendi-arabic', 'Arabic', 0, :p, 'active') RETURNING id"
        ), {"p": cats["mehendi"]})).scalar_one()
    response = await client.put("/api/v1/artists/me/profile", headers=headers, json={
        "business_name": "A", "city": "Bangalore", "category_ids": [sub_id],
    })
    assert response.status_code == 422
    assert response.json()["message"] == "Unknown category"


async def test_changing_the_profile_photo_deletes_the_old_one(client):
    headers = await sign_in(client, ARTIST_PHONE)
    cats = await categories(client)
    first, second = await upload_key(client, headers, "artist_photo"), await upload_key(client, headers, "artist_photo")
    base = {"business_name": "A", "city": "Pune", "category_ids": [cats["hair"]]}
    await client.put("/api/v1/artists/me/profile", headers=headers, json={**base, "photo_key": first})
    await client.put("/api/v1/artists/me/profile", headers=headers, json={**base, "photo_key": second})
    assert first in FakeStorage.deleted


async def test_service_crud(client):
    headers = await sign_in(client, ARTIST_PHONE)
    cats, tpl = await categories(client), await templates(client)
    await client.put("/api/v1/artists/me/profile", headers=headers, json={"business_name": "A", "city": "Pune", "category_ids": [cats["makeup"]]})
    added = await client.post("/api/v1/artists/me/services", headers=headers, json={
        "template_id": tpl["Party Makeup"], "price_paise": 300000, "duration_minutes": 90,
    })
    assert added.status_code == 201
    service = added.json()["services"][0]
    assert service | {"id": None, "category_id": None, "subcategory_id": None} == {
        "id": None, "category_id": None, "subcategory_id": None, "template_id": tpl["Party Makeup"],
        "name": "Party Makeup", "price_paise": 300000, "duration_minutes": 90, "description": None,
        "status": "approved", "rejection_reason": None,
    }
    assert service["subcategory_id"] == service["category_id"] != cats["makeup"]  # stored on the subcategory

    patched = await client.patch(f"/api/v1/artists/me/services/{service['id']}", headers=headers,
                                 json={"price_paise": 350000, "name": "Renamed"})  # the name isn't editable
    assert patched.json()["services"][0]["price_paise"] == 350000
    assert patched.json()["services"][0]["name"] == "Party Makeup"

    free = await client.post("/api/v1/artists/me/services", headers=headers, json={
        "template_id": tpl["Party Makeup"], "price_paise": 0, "duration_minutes": 30,
    })
    assert free.status_code == 422

    missing = await client.delete(f"/api/v1/artists/me/services/{uuid.uuid4()}", headers=headers)
    assert missing.status_code == 404
    deleted = await client.delete(f"/api/v1/artists/me/services/{service['id']}", headers=headers)
    assert deleted.json()["services"] == []


async def test_services_need_a_profile_first(client):
    headers = await sign_in(client, ARTIST_PHONE)
    tpl = await templates(client)
    response = await client.post("/api/v1/artists/me/services", headers=headers, json={
        "template_id": tpl["Party Makeup"], "price_paise": 100, "duration_minutes": 30,
    })
    assert response.status_code == 404


async def test_services_come_from_the_admin_list(client, engine):
    headers = await sign_in(client, ARTIST_PHONE)
    cats, tpl = await categories(client), await templates(client)
    await client.put("/api/v1/artists/me/profile", headers=headers, json={"business_name": "A", "city": "Pune", "category_ids": [cats["mehendi"]]})
    url = "/api/v1/artists/me/services"

    def body(template_id: int) -> dict:
        return {"template_id": template_id, "price_paise": 500000, "duration_minutes": 120}

    unknown = await client.post(url, headers=headers, json=body(999999))
    assert (unknown.status_code, unknown.json()["message"]) == (422, "Unknown service")
    other_category = await client.post(url, headers=headers, json=body(tpl["Party Makeup"]))
    assert (other_category.status_code, other_category.json()["message"]) == (422, "Pick that category on your profile first")
    assert (await client.post(url, headers=headers, json=body(tpl["Bridal Classic"]))).status_code == 201
    again = await client.post(url, headers=headers, json=body(tpl["Bridal Classic"]))
    assert (again.status_code, again.json()["code"]) == (409, "conflict")

    async with engine.begin() as conn:  # the admin renames one template and hides another
        await conn.execute(text("UPDATE service_templates SET name = 'Bridal Royal' WHERE id = :i"), {"i": tpl["Bridal Classic"]})
        await conn.execute(text("UPDATE service_templates SET is_active = false WHERE id = :i"), {"i": tpl["Bridal Full Arms"]})
    mine = (await client.get("/api/v1/artists/me", headers=headers)).json()
    assert [s["name"] for s in mine["services"]] == ["Bridal Royal"]
    hidden = await client.post(url, headers=headers, json=body(tpl["Bridal Full Arms"]))
    assert (hidden.status_code, hidden.json()["message"]) == (422, "Unknown service")


async def test_photos_add_reorder_delete(client):
    headers = await sign_in(client, ARTIST_PHONE)
    body = await complete_profile(client, headers, photos=3)
    ids = [p["id"] for p in body["photos"]]
    assert body["photos"][0]["card_url"].startswith("https://fake.storage/card/")

    reordered = await client.put("/api/v1/artists/me/photos/order", headers=headers, json={"photo_ids": ids[::-1]})
    assert [p["id"] for p in reordered.json()["photos"]] == ids[::-1]  # last photo is now the cover
    partial = await client.put("/api/v1/artists/me/photos/order", headers=headers, json={"photo_ids": ids[:2]})
    assert partial.status_code == 422

    removed_key = body["photos"][1]["key"]
    after = await client.delete(f"/api/v1/artists/me/photos/{ids[1]}", headers=headers)
    assert [p["id"] for p in after.json()["photos"]] == [ids[2], ids[0]]
    assert removed_key in FakeStorage.deleted

    dupe = await client.post("/api/v1/artists/me/photos", headers=headers, json={"key": body["photos"][0]["key"], "width": 1, "height": 1})
    assert dupe.status_code == 409


async def test_submit_lists_what_is_missing(client):
    headers = await sign_in(client, ARTIST_PHONE)
    cats = await categories(client)
    await client.put("/api/v1/artists/me/profile", headers=headers, json={"business_name": "A", "city": "Pune", "category_ids": [cats["decor"]]})
    response = await client.post("/api/v1/artists/me/submit", headers=headers)
    assert response.status_code == 422
    assert response.json()["code"] == "validation_error"
    assert response.json()["missing"] == ["photo", "services", "portfolio", "kyc"]
    assert response.json()["min_photos"] == 6


async def test_submit_moves_to_pending_and_locks_edits(client):
    headers = await sign_in(client, ARTIST_PHONE)
    await complete_profile(client, headers)
    submitted = await client.post("/api/v1/artists/me/submit", headers=headers)
    assert submitted.status_code == 200
    assert submitted.json()["status"] == "pending"
    assert submitted.json()["submitted_at"] is not None

    cats = await categories(client)
    locked = await client.put("/api/v1/artists/me/profile", headers=headers, json={"business_name": "B", "city": "Pune", "category_ids": [cats["decor"]]})
    assert locked.status_code == 409
    assert (await client.post("/api/v1/artists/me/submit", headers=headers)).status_code == 409


async def test_inactive_categories_stay_on_profiles_but_cannot_be_newly_picked(client, engine):
    headers = await sign_in(client, ARTIST_PHONE)
    cats = await categories(client)
    body = {"business_name": "A", "city": "Pune", "category_ids": [cats["mehendi"]]}
    assert (await client.put("/api/v1/artists/me/profile", headers=headers, json=body)).status_code == 200
    async with engine.begin() as conn:
        await conn.execute(text("UPDATE categories SET status = 'inactive' WHERE id = :i"), {"i": cats["mehendi"]})
        await conn.execute(text("UPDATE categories SET status = 'draft' WHERE id = :i"), {"i": cats["hair"]})

    assert (await client.put("/api/v1/artists/me/profile", headers=headers, json=body)).status_code == 200  # kept
    newcomer = await sign_in(client, "+919845011119")
    inactive = await client.put("/api/v1/artists/me/profile", headers=newcomer, json=body)
    assert (inactive.status_code, inactive.json()["message"]) == (422, "Unknown category")
    draft = await client.put("/api/v1/artists/me/profile", headers=headers, json={**body, "category_ids": [cats["mehendi"], cats["hair"]]})
    assert draft.status_code == 422
