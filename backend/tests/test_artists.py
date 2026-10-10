"""Artist onboarding contract: build the profile, add services and photos, then submit for review."""

import uuid

import pytest_asyncio
from sqlalchemy import text

from app.services.storage import FakeStorage
from app.utils.sms_provider import ConsoleSMSProvider

ARTIST_PHONE = "+919845011111"
CATEGORIES = [("mehendi", "Mehendi"), ("makeup", "Makeup"), ("hair", "Hair"),
              ("photography", "Photography"), ("decor", "Decor"), ("tattoo", "Tattoo")]


async def seed_categories(engine) -> None:
    """Admins create categories in the admin app; tests insert the design's six directly."""
    async with engine.begin() as conn:
        for i, (slug, name) in enumerate(CATEGORIES):
            await conn.execute(text("INSERT INTO categories (slug, name, sort_order) VALUES (:s, :n, :i)"), {"s": slug, "n": name, "i": i})


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


async def upload_key(client, headers, purpose: str) -> str:
    response = await client.post("/api/v1/uploads/signature", headers=headers, json={"purpose": purpose})
    assert response.status_code == 200
    return response.json()["key"]


async def complete_profile(client, headers, photos: int = 6) -> dict:
    """A submittable profile: photo, name, category, city, one service, `photos` portfolio photos."""
    cats = await categories(client)
    await client.put("/api/v1/artists/me/profile", headers=headers, json={
        "business_name": "Ayesha Mehendi Art", "city": "Bangalore",
        "category_ids": [cats["mehendi"]], "photo_key": await upload_key(client, headers, "artist_photo"),
    })
    await client.post("/api/v1/artists/me/services", headers=headers, json={
        "category_id": cats["mehendi"], "name": "Bridal Classic", "price_paise": 550000, "duration_minutes": 180,
    })
    for _ in range(photos):
        key = await upload_key(client, headers, "portfolio")
        await client.post("/api/v1/artists/me/photos", headers=headers, json={"key": key, "width": 1200, "height": 1500})
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
    cats = await categories(client)
    await client.put("/api/v1/artists/me/profile", headers=headers, json={"business_name": "A", "city": "Pune", "category_ids": [cats["makeup"]]})
    added = await client.post("/api/v1/artists/me/services", headers=headers, json={
        "category_id": cats["makeup"], "name": "Party makeup", "price_paise": 300000, "duration_minutes": 90,
    })
    assert added.status_code == 201
    service_id = added.json()["services"][0]["id"]

    patched = await client.patch(f"/api/v1/artists/me/services/{service_id}", headers=headers, json={"price_paise": 350000})
    assert patched.json()["services"][0]["price_paise"] == 350000
    assert patched.json()["services"][0]["name"] == "Party makeup"

    bad = await client.post("/api/v1/artists/me/services", headers=headers, json={
        "category_id": cats["makeup"], "name": "Free", "price_paise": 0, "duration_minutes": 30,
    })
    assert bad.status_code == 422

    missing = await client.delete(f"/api/v1/artists/me/services/{uuid.uuid4()}", headers=headers)
    assert missing.status_code == 404
    deleted = await client.delete(f"/api/v1/artists/me/services/{service_id}", headers=headers)
    assert deleted.json()["services"] == []


async def test_services_need_a_profile_first(client):
    headers = await sign_in(client, ARTIST_PHONE)
    cats = await categories(client)
    response = await client.post("/api/v1/artists/me/services", headers=headers, json={
        "category_id": cats["makeup"], "name": "X", "price_paise": 100, "duration_minutes": 30,
    })
    assert response.status_code == 404


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
    assert response.json()["missing"] == ["photo", "services", "portfolio"]
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
