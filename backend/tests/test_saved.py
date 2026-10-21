"""Saved (bookmarks): a signed-in customer saves posts, artists and shop products, lists each kind newest-saved
first (only what customers can see right now), reads every saved id for the bookmark icons, and unsaves."""

import pytest_asyncio
from sqlalchemy import text

from app.core.rate_limit import Limit
from app.saved.dependencies import saves_per_user
from tests.support.artist import approved_artist, complete_profile
from tests.support.auth import sign_in
from tests.support.booking import setup
from tests.support.catalog import seed_categories
from tests.support.upload import upload_key

SAVED = "/api/v1/saved"
FEED = "/api/v1/feed"
MY_POSTS = "/api/v1/artists/me/posts"
MY_SHOP = "/api/v1/artists/me/shop"


@pytest_asyncio.fixture(autouse=True)
async def categories_seeded(engine):
    await seed_categories(engine)


async def photo_post(client, artist: dict, caption: str = "Bridal set") -> dict:
    key = await upload_key(client, artist["headers"], "post")
    body = {"kind": "photos", "text": caption, "photos": [{"key": key, "width": 1080, "height": 1350}]}
    response = await client.post(MY_POSTS, headers=artist["headers"], json=body)
    assert response.status_code == 201, response.text
    return response.json()


async def product(client, artist: dict, name: str = "Organic henna cones") -> dict:
    key = await upload_key(client, artist["headers"], "shop")
    body = {
        "name": name,
        "category": "henna",
        "price_paise": 48000,
        "stock": 10,
        "photos": [{"key": key, "width": 1200, "height": 1200}],
    }
    response = await client.post(f"{MY_SHOP}/products", headers=artist["headers"], json=body)
    assert response.status_code == 201, response.text
    return response.json()


async def save(client, headers, kind: str, target_id: str):
    return await client.put(f"{SAVED}/{kind}/{target_id}", headers=headers)


async def unsave(client, headers, kind: str, target_id: str):
    return await client.delete(f"{SAVED}/{kind}/{target_id}", headers=headers)


async def ids(client, headers) -> dict:
    response = await client.get(f"{SAVED}/ids", headers=headers)
    assert response.status_code == 200, response.text
    return response.json()


async def listed(client, headers, kind: str, **params) -> dict:
    response = await client.get(f"{SAVED}/{kind}s", headers=headers, params=params)
    assert response.status_code == 200, response.text
    return response.json()


async def test_save_and_unsave_each_kind_idempotently(client, engine):
    _, artist, customer = await setup(client, engine)
    post = await photo_post(client, artist)
    item = await product(client, artist)
    targets = {"post": post["id"], "artist": artist["id"], "product": item["id"]}

    for kind, target in targets.items():
        assert (await save(client, customer, kind, target)).status_code == 204
        assert (await save(client, customer, kind, target)).status_code == 204
    saved = await ids(client, customer)
    for kind, target in targets.items():
        assert (await unsave(client, customer, kind, target)).status_code == 204
        assert (await unsave(client, customer, kind, target)).status_code == 204

    assert saved == {"posts": [post["id"]], "artists": [artist["id"]], "products": [item["id"]]}
    assert await ids(client, customer) == {"posts": [], "artists": [], "products": []}


async def test_saved_posts_newest_saved_first_with_paging_and_the_readers_flags(client, engine):
    _, artist, customer = await setup(client, engine)
    older = await photo_post(client, artist, "older post")
    newer = await photo_post(client, artist, "newer post")
    await save(client, customer, "post", newer["id"])
    await save(client, customer, "post", older["id"])  # saved last, so listed first
    await client.put(f"{FEED}/posts/{older['id']}/like", headers=customer)

    first = await listed(client, customer, "post", limit=1)
    second = await listed(client, customer, "post", limit=1, cursor=first["next_cursor"])

    assert [p["id"] for p in first["items"]] == [older["id"]]
    assert (first["items"][0]["liked"], first["items"][0]["like_count"]) == (True, 1)
    assert first["items"][0]["artist"]["business_name"] == "Ayesha Mehendi Art"
    assert [p["id"] for p in second["items"]] == [newer["id"]]
    assert second["next_cursor"] is None


async def test_saved_artists_and_products_newest_saved_first_with_paging(client, engine):
    admin, artist, customer = await setup(client, engine)
    rival = await approved_artist(client, engine, "+919845091002", admin, name="Meher by Riya")
    cones = await product(client, artist, "Henna cones")
    oil = await product(client, rival, "Eucalyptus oil")
    await save(client, customer, "artist", rival["id"])
    await save(client, customer, "artist", artist["id"])
    await save(client, customer, "product", cones["id"])
    await save(client, customer, "product", oil["id"])

    artists_1 = await listed(client, customer, "artist", limit=1)
    artists_2 = await listed(client, customer, "artist", limit=1, cursor=artists_1["next_cursor"])
    products_1 = await listed(client, customer, "product", limit=1)
    products_2 = await listed(client, customer, "product", limit=1, cursor=products_1["next_cursor"])

    assert [a["business_name"] for a in artists_1["items"] + artists_2["items"]] == [
        "Ayesha Mehendi Art",
        "Meher by Riya",
    ]
    assert artists_1["items"][0]["from_price_paise"] == 550000
    assert artists_2["next_cursor"] is None
    assert [p["name"] for p in products_1["items"] + products_2["items"]] == ["Eucalyptus oil", "Henna cones"]
    assert products_1["items"][0]["seller"]["business_name"] == "Meher by Riya"
    assert products_2["next_cursor"] is None


async def test_taken_down_targets_leave_the_lists_but_stay_in_ids_and_can_be_unsaved(client, engine):
    admin, artist, customer = await setup(client, engine)
    rival = await approved_artist(client, engine, "+919845091002", admin, name="Meher by Riya")
    post = await photo_post(client, rival)
    item = await product(client, rival)
    for kind, target in (("post", post["id"]), ("artist", artist["id"]), ("product", item["id"])):
        await save(client, customer, kind, target)

    hidden = await client.post(
        f"/api/v1/admin/feed/posts/{post['id']}/moderate", headers=admin, json={"decision": "hide"}
    )
    suspended = await client.post(
        f"/api/v1/admin/artists/{artist['id']}/suspend", headers=admin, json={"reason": "Complaints"}
    )
    off = await client.patch(f"{MY_SHOP}/products/{item['id']}", headers=rival["headers"], json={"is_active": False})

    assert (hidden.status_code, suspended.status_code, off.status_code) == (200, 200, 200)
    for kind in ("post", "artist", "product"):
        assert (await listed(client, customer, kind))["items"] == []
    assert await ids(client, customer) == {"posts": [post["id"]], "artists": [artist["id"]], "products": [item["id"]]}
    for kind, target in (("post", post["id"]), ("artist", artist["id"]), ("product", item["id"])):
        assert (await unsave(client, customer, kind, target)).status_code == 204
    assert await ids(client, customer) == {"posts": [], "artists": [], "products": []}


async def test_saving_something_customers_cannot_see_is_404(client, engine):
    admin, artist, customer = await setup(client, engine)
    post = await photo_post(client, artist)
    item = await product(client, artist)
    draft_id = (await complete_profile(client, await sign_in(client, "+919845066611")))["id"]
    await client.post(f"/api/v1/admin/feed/posts/{post['id']}/moderate", headers=admin, json={"decision": "remove"})
    await client.patch(f"{MY_SHOP}/products/{item['id']}", headers=artist["headers"], json={"is_active": False})
    unknown = "00000000-0000-0000-0000-000000000000"

    responses = [
        await save(client, customer, "post", post["id"]),
        await save(client, customer, "artist", draft_id),
        await save(client, customer, "product", item["id"]),
        *[await save(client, customer, kind, unknown) for kind in ("post", "artist", "product")],
    ]

    assert [(r.status_code, r.json()["message"]) for r in responses] == [(404, "Not found")] * 6
    assert await ids(client, customer) == {"posts": [], "artists": [], "products": []}


async def test_an_unknown_kind_is_422(client, engine):
    _, artist, customer = await setup(client, engine)

    assert (await save(client, customer, "booking", artist["id"])).status_code == 422
    assert (await unsave(client, customer, "booking", artist["id"])).status_code == 422
    assert (await client.get(f"{SAVED}/bookings", headers=customer)).status_code in (404, 405)


async def test_only_signed_in_customers_save(client, engine):
    _, artist, _ = await setup(client, engine)

    assert (await save(client, artist["headers"], "artist", artist["id"])).status_code == 403
    assert (await client.get(f"{SAVED}/ids", headers=artist["headers"])).status_code == 403
    assert (await client.put(f"{SAVED}/artist/{artist['id']}")).status_code == 401
    assert (await client.get(f"{SAVED}/posts")).status_code == 401


async def test_saving_is_rate_limited_per_user(client, engine, override):
    override(saves_per_user, lambda: Limit(hits=1, window_seconds=3600))
    _, artist, customer = await setup(client, engine)

    assert (await save(client, customer, "artist", artist["id"])).status_code == 204
    second = await save(client, customer, "artist", artist["id"])

    assert (second.status_code, second.json()["code"]) == (429, "rate_limited")


async def test_deleting_the_account_removes_saved_items(client, engine):
    _, artist, customer = await setup(client, engine)
    await save(client, customer, "artist", artist["id"])

    assert (await client.delete("/api/v1/users/me", headers=customer)).status_code == 204

    async with engine.connect() as conn:
        assert (await conn.execute(text("SELECT count(*) FROM saved_item"))).scalar_one() == 0
