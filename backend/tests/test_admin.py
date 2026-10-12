"""Admin contract: category management and the artist review queue (approve / reject)."""

from sqlalchemy import text as sql_text

from tests.test_artists import complete_profile, seed_categories, sign_in

ADMIN_PHONE = "+919845000001"


async def admin(client, engine) -> dict:
    return await sign_in(client, ADMIN_PHONE, role="admin", engine=engine)


# --- categories -------------------------------------------------------------

async def test_admin_endpoints_refuse_non_admins(client):
    headers = await sign_in(client, "+919845011112", role="artist")
    for method, path in (("get", "/api/v1/admin/categories"), ("get", "/api/v1/admin/artists"),
                         ("get", "/api/v1/admin/service-templates?subcategory_id=1")):
        response = await getattr(client, method)(path, headers=headers)
        assert response.status_code == 403
        assert response.json()["code"] == "forbidden"


async def test_create_category_derives_slug_and_order(client, engine):
    headers = await admin(client, engine)
    first = await client.post("/api/v1/admin/categories", headers=headers, json={"name": "Bridal Makeup"})
    assert first.status_code == 201
    assert first.json() | {"id": 0} == {
        "id": 0, "slug": "bridal-makeup", "name": "Bridal Makeup", "sort_order": 0, "is_active": True,
        "parent_id": None, "artist_count": 0, "service_count": 0, "child_count": 0, "template_count": 0,
    }
    second = await client.post("/api/v1/admin/categories", headers=headers, json={"name": "Nail Art", "is_active": False})
    assert second.json()["sort_order"] == 1

    public = (await client.get("/api/v1/categories")).json()
    assert [c["slug"] for c in public] == ["bridal-makeup"]  # inactive ones stay hidden from apps
    assert [c["slug"] for c in (await client.get("/api/v1/admin/categories", headers=headers)).json()] == ["bridal-makeup", "nail-art"]


async def test_category_names_and_slugs_are_unique(client, engine):
    headers = await admin(client, engine)
    await client.post("/api/v1/admin/categories", headers=headers, json={"name": "Mehendi"})
    dupe = await client.post("/api/v1/admin/categories", headers=headers, json={"name": "mehendi"})
    assert dupe.status_code == 409
    bad_slug = await client.post("/api/v1/admin/categories", headers=headers, json={"name": "X", "slug": "Not A Slug"})
    assert bad_slug.status_code == 422


async def test_update_and_delete_category(client, engine):
    headers = await admin(client, engine)
    created = (await client.post("/api/v1/admin/categories", headers=headers, json={"name": "Decor"})).json()
    patched = await client.patch(f"/api/v1/admin/categories/{created['id']}", headers=headers, json={"name": "Event Decor", "is_active": False})
    assert patched.json()["name"] == "Event Decor"
    assert patched.json()["slug"] == "decor"  # slug is stable unless set explicitly
    assert patched.json()["is_active"] is False

    assert (await client.delete(f"/api/v1/admin/categories/{created['id']}", headers=headers)).status_code == 204
    assert (await client.delete(f"/api/v1/admin/categories/{created['id']}", headers=headers)).status_code == 404


async def test_category_in_use_cannot_be_deleted(client, engine):
    await seed_categories(engine)
    artist = await sign_in(client, "+919845011113")
    await complete_profile(client, artist, photos=0)
    headers = await admin(client, engine)
    mehendi = next(c for c in (await client.get("/api/v1/admin/categories", headers=headers)).json() if c["slug"] == "mehendi")
    assert mehendi["artist_count"] == 1
    assert mehendi["service_count"] == 1
    response = await client.delete(f"/api/v1/admin/categories/{mehendi['id']}", headers=headers)
    assert response.status_code == 409


async def create_category(client, headers, **body) -> dict:
    response = await client.post("/api/v1/admin/categories", headers=headers, json=body)
    assert response.status_code == 201, response.json()
    return response.json()


async def test_subcategories_sit_under_a_top_level_category(client, engine):
    headers = await admin(client, engine)
    makeup = await create_category(client, headers, name="Makeup")
    bridal = await create_category(client, headers, name="Bridal", parent_id=makeup["id"])
    assert bridal["slug"] == "makeup-bridal"
    assert bridal["parent_id"] == makeup["id"]
    assert bridal["sort_order"] == 0  # ordered among its siblings

    too_deep = await client.post("/api/v1/admin/categories", headers=headers, json={"name": "HD", "parent_id": bridal["id"]})
    assert too_deep.status_code == 422
    assert too_deep.json()["code"] == "validation_error"
    no_parent = await client.post("/api/v1/admin/categories", headers=headers, json={"name": "HD", "parent_id": 9999})
    assert no_parent.status_code == 422

    listed = (await client.get("/api/v1/admin/categories", headers=headers)).json()
    assert [(c["slug"], c["parent_id"], c["child_count"]) for c in listed] == [
        ("makeup", None, 1), ("makeup-bridal", makeup["id"], 0),
    ]


async def test_subcategory_names_are_unique_per_parent(client, engine):
    headers = await admin(client, engine)
    makeup = await create_category(client, headers, name="Makeup")
    mehendi = await create_category(client, headers, name="Mehendi")
    await create_category(client, headers, name="Bridal", parent_id=makeup["id"])
    other = await create_category(client, headers, name="Bridal", parent_id=mehendi["id"])  # another parent is fine
    assert other["slug"] == "mehendi-bridal"
    dupe = await client.post("/api/v1/admin/categories", headers=headers, json={"name": "bridal", "parent_id": makeup["id"]})
    assert dupe.status_code == 409


async def test_moving_categories_keeps_two_levels(client, engine):
    headers = await admin(client, engine)
    makeup = await create_category(client, headers, name="Makeup")
    hair = await create_category(client, headers, name="Hair")
    bridal = await create_category(client, headers, name="Bridal", parent_id=makeup["id"])
    url = "/api/v1/admin/categories/{}"

    has_children = await client.patch(url.format(makeup["id"]), headers=headers, json={"parent_id": hair["id"]})
    assert has_children.status_code == 422
    own_parent = await client.patch(url.format(hair["id"]), headers=headers, json={"parent_id": hair["id"]})
    assert own_parent.status_code == 422

    moved = await client.patch(url.format(bridal["id"]), headers=headers, json={"parent_id": hair["id"]})
    assert moved.status_code == 200
    assert moved.json()["parent_id"] == hair["id"]
    promoted = await client.patch(url.format(bridal["id"]), headers=headers, json={"parent_id": None})
    assert promoted.json()["parent_id"] is None


async def test_category_with_subcategories_cannot_be_deleted(client, engine):
    headers = await admin(client, engine)
    makeup = await create_category(client, headers, name="Makeup")
    bridal = await create_category(client, headers, name="Bridal", parent_id=makeup["id"])
    assert (await client.delete(f"/api/v1/admin/categories/{makeup['id']}", headers=headers)).status_code == 409
    assert (await client.delete(f"/api/v1/admin/categories/{bridal['id']}", headers=headers)).status_code == 204
    assert (await client.delete(f"/api/v1/admin/categories/{makeup['id']}", headers=headers)).status_code == 204


# --- artist review ------------------------------------------------------------

async def submitted_artist(client, engine, phone: str) -> dict:
    headers = await sign_in(client, phone)
    await complete_profile(client, headers)
    await client.post("/api/v1/artists/me/submit", headers=headers)
    return headers


async def test_queue_lists_pending_oldest_first_with_paging(client, engine):
    await seed_categories(engine)
    for phone in ("+919845020001", "+919845020002", "+919845020003"):
        await submitted_artist(client, engine, phone)
    draft = await sign_in(client, "+919845020004")
    await complete_profile(client, draft, photos=0)  # drafts never show up
    headers = await admin(client, engine)

    page1 = (await client.get("/api/v1/admin/artists?limit=2", headers=headers)).json()
    assert len(page1["items"]) == 2
    assert page1["items"][0]["photo_count"] == 6
    assert page1["items"][0]["categories"] == ["Mehendi"]
    page2 = (await client.get(f"/api/v1/admin/artists?limit=2&cursor={page1['next_cursor']}", headers=headers)).json()
    assert len(page2["items"]) == 1
    assert page2["next_cursor"] is None
    times = [i["submitted_at"] for i in page1["items"] + page2["items"]]
    assert times == sorted(times)


async def test_detail_includes_owner_and_full_profile(client, engine):
    await seed_categories(engine)
    await submitted_artist(client, engine, "+919845020005")
    headers = await admin(client, engine)
    artist_id = (await client.get("/api/v1/admin/artists", headers=headers)).json()["items"][0]["id"]
    detail = (await client.get(f"/api/v1/admin/artists/{artist_id}", headers=headers)).json()
    assert detail["owner"]["phone"] == "+919845020005"
    assert len(detail["photos"]) == 6
    assert detail["services"][0]["name"] == "Bridal Classic"


async def test_approve(client, engine):
    await seed_categories(engine)
    artist = await submitted_artist(client, engine, "+919845020006")
    headers = await admin(client, engine)
    artist_id = (await client.get("/api/v1/admin/artists", headers=headers)).json()["items"][0]["id"]

    approved = await client.post(f"/api/v1/admin/artists/{artist_id}/approve", headers=headers)
    assert approved.status_code == 200
    assert approved.json()["status"] == "approved"
    assert approved.json()["reviewed_at"] is not None
    assert (await client.get("/api/v1/artists/me", headers=artist)).json()["status"] == "approved"
    assert (await client.post(f"/api/v1/admin/artists/{artist_id}/approve", headers=headers)).status_code == 409
    assert (await client.get("/api/v1/admin/artists?status=approved", headers=headers)).json()["items"][0]["id"] == artist_id


async def test_reject_then_edit_and_resubmit(client, engine):
    await seed_categories(engine)
    artist = await submitted_artist(client, engine, "+919845020007")
    headers = await admin(client, engine)
    artist_id = (await client.get("/api/v1/admin/artists", headers=headers)).json()["items"][0]["id"]

    no_reason = await client.post(f"/api/v1/admin/artists/{artist_id}/reject", headers=headers, json={"reason": ""})
    assert no_reason.status_code == 422
    rejected = await client.post(f"/api/v1/admin/artists/{artist_id}/reject", headers=headers, json={"reason": "Photos are blurry"})
    assert rejected.json()["status"] == "rejected"

    mine = (await client.get("/api/v1/artists/me", headers=artist)).json()
    assert mine["rejection_reason"] == "Photos are blurry"
    photo_id = mine["photos"][0]["id"]
    assert (await client.delete(f"/api/v1/artists/me/photos/{photo_id}", headers=artist)).status_code == 200  # editable again
    assert (await client.post("/api/v1/artists/me/submit", headers=artist)).status_code == 422  # now 5 photos

    await complete_profile(client, artist, photos=1)
    resubmitted = (await client.post("/api/v1/artists/me/submit", headers=artist)).json()
    assert resubmitted["status"] == "pending"
    assert resubmitted["rejection_reason"] is None


async def test_unknown_or_draft_artist_is_not_found(client, engine):
    await seed_categories(engine)
    draft = await sign_in(client, "+919845020008")
    profile = await complete_profile(client, draft, photos=0)
    headers = await admin(client, engine)
    assert (await client.get(f"/api/v1/admin/artists/{profile['id']}", headers=headers)).status_code == 404
    assert (await client.get("/api/v1/admin/artists?cursor=garbage", headers=headers)).status_code == 422


# --- Aadhaar verification ---------------------------------------------------

async def submitted_artist_id(client, phone="+919845066601") -> str:
    headers = await sign_in(client, phone, role="artist")
    await complete_profile(client, headers)
    assert (await client.post("/api/v1/artists/me/submit", headers=headers)).status_code == 200
    return (await client.get("/api/v1/artists/me", headers=headers)).json()["id"]


async def test_admin_detail_shows_masked_aadhaar_and_private_links(client, engine):
    await seed_categories(engine)
    artist_id = await submitted_artist_id(client)
    headers = await admin(client, engine)
    kyc = (await client.get(f"/api/v1/admin/artists/{artist_id}", headers=headers)).json()["kyc"]
    assert kyc["aadhaar_masked"] == "•••• •••• 2346"
    assert kyc["front_url"].startswith("https://fake.storage/private/") and "/aadhaar/" in kyc["front_url"]
    assert kyc["back_url"].startswith("https://fake.storage/private/")
    assert kyc["front_url"] != kyc["back_url"]
    assert "234123412346" not in str(kyc)


async def test_reveal_returns_the_number_and_logs_it(client, engine):
    await seed_categories(engine)
    artist_id = await submitted_artist_id(client)
    headers = await admin(client, engine)
    response = await client.post(f"/api/v1/admin/artists/{artist_id}/kyc/reveal", headers=headers)
    assert response.status_code == 200
    assert response.json() == {"aadhaar_number": "234123412346"}
    assert response.headers["cache-control"] == "no-store"
    async with engine.connect() as conn:
        rows = (await conn.execute(sql_text(
            "SELECT r.artist_id::text, u.phone FROM aadhaar_reveals r JOIN users u ON u.id = r.admin_id"
        ))).all()
    assert [(r[0], r[1]) for r in rows] == [(artist_id, ADMIN_PHONE)]


async def test_reveal_is_admin_only_and_needs_kyc(client, engine):
    await seed_categories(engine)
    artist_id = await submitted_artist_id(client)
    artist_headers = await sign_in(client, "+919845066602", role="artist")
    forbidden = await client.post(f"/api/v1/admin/artists/{artist_id}/kyc/reveal", headers=artist_headers)
    assert forbidden.status_code == 403

    headers = await admin(client, engine)
    async with engine.begin() as conn:
        await conn.execute(sql_text("DELETE FROM artist_kyc"))  # a profile submitted before this increment
    detail = (await client.get(f"/api/v1/admin/artists/{artist_id}", headers=headers)).json()
    assert detail["kyc"] is None
    missing = await client.post(f"/api/v1/admin/artists/{artist_id}/kyc/reveal", headers=headers)
    assert missing.status_code == 404
