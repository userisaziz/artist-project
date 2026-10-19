"""Feed moderation: customers report posts; admins see every post with its reports, keep (clearing reports),
hide or remove it, and feature up to 12 posts at the top of For you."""

import pytest_asyncio

from tests.support.auth import sign_in
from tests.support.booking import setup
from tests.support.catalog import seed_categories
from tests.support.upload import upload_key

FEED = "/api/v1/feed"
ADMIN = "/api/v1/admin/feed"


@pytest_asyncio.fixture(autouse=True)
async def categories_seeded(engine):
    await seed_categories(engine)


async def post(client, artist, caption="Bridal set"):
    key = await upload_key(client, artist["headers"], "post")
    response = await client.post(
        "/api/v1/artists/me/posts",
        headers=artist["headers"],
        json={"kind": "photos", "text": caption, "photos": [{"key": key, "width": 1080, "height": 1350}]},
    )
    assert response.status_code == 201, response.text
    return response.json()


async def test_customers_report_a_post_once_and_admins_see_it(client, engine):
    admin, artist, customer = await setup(client, engine)
    other = await sign_in(client, "+919845080002", role="customer")
    p = await post(client, artist)

    first = await client.post(f"{FEED}/posts/{p['id']}/report", headers=customer, json={"reason": "spam"})
    again = await client.post(f"{FEED}/posts/{p['id']}/report", headers=customer, json={"reason": "spam"})
    await client.post(f"{FEED}/posts/{p['id']}/report", headers=other, json={"reason": "inappropriate"})
    reported = (await client.get(f"{ADMIN}/posts", headers=admin, params={"view": "reported"})).json()["items"]

    assert (first.status_code, again.status_code) == (204, 204)
    assert [r["id"] for r in reported] == [p["id"]]
    assert reported[0]["report_count"] == 2
    assert reported[0]["moderation"] == "live"


async def test_keep_clears_reports_hide_and_remove_take_the_post_down(client, engine):
    admin, artist, customer = await setup(client, engine)
    p = await post(client, artist)
    await client.post(f"{FEED}/posts/{p['id']}/report", headers=customer, json={"reason": "spam"})

    kept = await client.post(f"{ADMIN}/posts/{p['id']}/moderate", headers=admin, json={"decision": "keep"})
    still_reported = (await client.get(f"{ADMIN}/posts", headers=admin, params={"view": "reported"})).json()["items"]
    hidden = await client.post(
        f"{ADMIN}/posts/{p['id']}/moderate", headers=admin, json={"decision": "hide", "note": "Blurry"}
    )
    customer_view = await client.get(f"{FEED}/posts/{p['id']}", headers=customer)
    mine = (await client.get("/api/v1/artists/me/posts", headers=artist["headers"])).json()["items"]
    removed = await client.post(f"{ADMIN}/posts/{p['id']}/moderate", headers=admin, json={"decision": "remove"})

    assert (kept.json()["moderation"], kept.json()["report_count"]) == ("live", 0)
    assert still_reported == []
    assert (hidden.json()["moderation"], hidden.json()["moderation_note"]) == ("hidden", "Blurry")
    assert customer_view.status_code == 404
    assert mine[0]["moderation"] == "hidden"  # the artist sees it was taken down
    assert removed.json()["moderation"] == "removed"


async def test_featured_posts_lead_for_you_and_slots_are_capped(client, engine, override):
    from app.feed.dependencies import featured_slots

    admin, artist, customer = await setup(client, engine)
    older = await post(client, artist, "older")
    newer = await post(client, artist, "newer")
    override(featured_slots, lambda: 1)

    featured = await client.post(f"{ADMIN}/posts/{older['id']}/feature", headers=admin)
    full = await client.post(f"{ADMIN}/posts/{newer['id']}/feature", headers=admin)
    page = (await client.get(FEED, headers=customer)).json()["items"]
    summary = (await client.get(f"{ADMIN}/summary", headers=admin)).json()
    unfeatured = await client.delete(f"{ADMIN}/posts/{older['id']}/feature", headers=admin)

    assert featured.json()["featured"] is True
    assert full.status_code == 409
    assert [p["id"] for p in page] == [older["id"], newer["id"]]  # featured first, then newest
    assert summary["counts"]["featured"] == 1 and summary["featured_slots"] == 1
    assert unfeatured.json()["featured"] is False


async def test_admin_views_and_summary(client, engine):
    admin, artist, _ = await setup(client, engine)
    a = await post(client, artist, "a")
    b = await post(client, artist, "b")
    await client.post(f"{ADMIN}/posts/{b['id']}/moderate", headers=admin, json={"decision": "hide"})

    everything = (await client.get(f"{ADMIN}/posts", headers=admin)).json()["items"]
    hidden = (await client.get(f"{ADMIN}/posts", headers=admin, params={"view": "hidden"})).json()["items"]
    summary = (await client.get(f"{ADMIN}/summary", headers=admin)).json()

    assert [p["id"] for p in everything] == [b["id"], a["id"]]
    assert [p["id"] for p in hidden] == [b["id"]]
    assert summary["counts"] == {"all": 2, "featured": 0, "reported": 0, "hidden": 1}
    assert summary["posts_7d"] == 2


async def test_moderation_is_admin_only_and_reports_need_a_visible_post(client, engine):
    admin, artist, customer = await setup(client, engine)
    p = await post(client, artist)
    await client.post(f"{ADMIN}/posts/{p['id']}/moderate", headers=admin, json={"decision": "remove"})

    assert (
        await client.post(f"{FEED}/posts/{p['id']}/report", headers=customer, json={"reason": "spam"})
    ).status_code == 404
    assert (await client.get(f"{ADMIN}/posts", headers=customer)).status_code == 403
    assert (
        await client.post(f"{ADMIN}/posts/{p['id']}/moderate", headers=admin, json={"decision": "zap"})
    ).status_code == 422
