"""Feed contract: approved artists publish photo posts and articles; customers read the feed (For you,
Following, Stories & guides), open articles, like posts and follow artists."""

import pytest_asyncio
from sqlalchemy import text

from app.core.rate_limit import Limit
from app.feed.dependencies import posts_per_user
from app.feed.utils import excerpt, read_minutes
from tests.support.artist import approved_artist
from tests.support.auth import sign_in
from tests.support.booking import setup
from tests.support.catalog import seed_categories
from tests.support.upload import upload_key

MINE = "/api/v1/artists/me/posts"
FEED = "/api/v1/feed"


@pytest_asyncio.fixture(autouse=True)
async def categories_seeded(engine):
    await seed_categories(engine)


async def photo_post(client, artist: dict, caption: str = "Priya's bridal set 💗", photos: int = 2, **extra):
    keys = [await upload_key(client, artist["headers"], "post") for _ in range(photos)]
    body = {
        "kind": "photos",
        "text": caption,
        "photos": [{"key": k, "width": 1080, "height": 1350} for k in keys],
        **extra,
    }
    return await client.post(MINE, headers=artist["headers"], json=body)


async def article(client, artist: dict, title: str = "How to get the darkest bridal mehendi stain", **extra):
    body = {
        "kind": "article",
        "topic": "guide",
        "title": title,
        "text": "The colour is decided long before the paste comes off.\n\n## 1. Book it 48 hours early\n\n"
        + "Henna keeps darkening for two days. " * 60,
        "cover": {"key": await upload_key(client, artist["headers"], "post"), "width": 1600, "height": 900},
        **extra,
    }
    return await client.post(MINE, headers=artist["headers"], json=body)


async def test_artist_publishes_a_photo_post_with_a_linked_service(client, engine):
    _, artist, _ = await setup(client, engine)

    response = await photo_post(client, artist, service_id=artist["service_id"])

    assert response.status_code == 201, response.text
    p = response.json()
    assert (p["kind"], p["topic"], p["text"], p["like_count"]) == ("photos", "look", "Priya's bridal set 💗", 0)
    assert len(p["photos"]) == 2 and p["photos"][0]["url"].startswith("https://")
    assert p["service"] == {"id": artist["service_id"], "name": "Bridal Classic", "price_paise": 550000}
    assert p["artist"]["business_name"] == "Ayesha Mehendi Art"
    mine = (await client.get(MINE, headers=artist["headers"])).json()
    assert [i["id"] for i in mine["items"]] == [p["id"]]


async def test_articles_get_an_excerpt_and_reading_time(client, engine):
    _, artist, customer = await setup(client, engine)
    a = (await article(client, artist)).json()

    card = (await client.get(FEED, headers=customer)).json()["items"][0]
    full = (await client.get(f"{FEED}/posts/{a['id']}", headers=customer)).json()

    assert card["excerpt"] == "The colour is decided long before the paste comes off."
    assert card["read_minutes"] >= 2
    assert card["body"] is None
    assert full["body"].startswith("The colour is decided")
    assert full["cover_url"].startswith("https://")
    assert full["artist"]["rating_count"] == 0


async def test_posts_are_validated(client, engine):
    admin, artist, _ = await setup(client, engine)
    rival = await approved_artist(client, engine, "+919845091002", admin, name="Meher by Riya")
    stolen = await upload_key(client, rival["headers"], "post")

    no_photos = await client.post(MINE, headers=artist["headers"], json={"kind": "photos", "text": "x", "photos": []})
    untitled = await client.post(MINE, headers=artist["headers"], json={"kind": "article", "text": "body"})
    foreign_key = await client.post(
        MINE,
        headers=artist["headers"],
        json={"kind": "photos", "text": "x", "photos": [{"key": stolen, "width": 10, "height": 10}]},
    )
    foreign_service = await photo_post(client, artist, service_id=rival["service_id"])
    contact = await photo_post(client, artist, caption="WhatsApp 98450 67890 to book")

    assert no_photos.status_code == 422
    assert untitled.status_code == 422
    assert foreign_key.status_code == 422
    assert foreign_service.status_code == 422
    assert contact.status_code == 422


async def test_only_approved_artists_post(client, engine):
    headers = await sign_in(client, "+919845066609", role="artist")

    response = await client.post(MINE, headers=headers, json={"kind": "photos", "text": "x", "photos": []})

    assert response.status_code in (404, 409, 422)
    assert (await client.get(FEED, headers=headers)).status_code == 403


async def test_feed_tabs_newest_first_with_paging(client, engine):
    admin, artist, customer = await setup(client, engine)
    rival = await approved_artist(client, engine, "+919845091002", admin, name="Meher by Riya")
    p1 = (await photo_post(client, artist, "first")).json()
    a1 = (await article(client, rival)).json()
    p2 = (await photo_post(client, rival, "third")).json()
    await client.put(f"{FEED}/artists/{artist['id']}/follow", headers=customer)

    everything = (await client.get(FEED, headers=customer)).json()["items"]
    following = (await client.get(FEED, headers=customer, params={"tab": "following"})).json()["items"]
    stories = (await client.get(FEED, headers=customer, params={"tab": "stories"})).json()["items"]
    first = (await client.get(FEED, headers=customer, params={"limit": 2})).json()
    rest = (await client.get(FEED, headers=customer, params={"limit": 2, "cursor": first["next_cursor"]})).json()

    assert [i["id"] for i in everything] == [p2["id"], a1["id"], p1["id"]]
    assert [i["id"] for i in following] == [p1["id"]]
    assert following[0]["following"] is True
    assert [i["id"] for i in stories] == [a1["id"]]
    assert [i["id"] for i in first["items"] + rest["items"]] == [p2["id"], a1["id"], p1["id"]]


async def test_posts_of_artists_no_longer_approved_disappear(client, engine):
    _, artist, customer = await setup(client, engine)
    p = (await photo_post(client, artist)).json()
    async with engine.begin() as conn:
        await conn.execute(text("UPDATE artist_profile SET status='rejected' WHERE id=:id"), {"id": artist["id"]})

    assert (await client.get(FEED, headers=customer)).json()["items"] == []
    assert (await client.get(f"{FEED}/posts/{p['id']}", headers=customer)).status_code == 404


async def test_liking_is_idempotent_and_counted(client, engine):
    _, artist, customer = await setup(client, engine)
    other = await sign_in(client, "+919845080002", role="customer")
    p = (await photo_post(client, artist)).json()
    like = f"{FEED}/posts/{p['id']}/like"

    first = await client.put(like, headers=customer)
    again = await client.put(like, headers=customer)
    await client.put(like, headers=other)
    seen = (await client.get(f"{FEED}/posts/{p['id']}", headers=customer)).json()
    undone = await client.delete(like, headers=customer)

    assert first.status_code == 200, first.text
    assert first.json() == {"liked": True, "like_count": 1}
    assert again.json() == {"liked": True, "like_count": 1}
    assert (seen["liked"], seen["like_count"]) == (True, 2)
    assert undone.json() == {"liked": False, "like_count": 1}


async def test_following_is_idempotent_and_needs_an_approved_artist(client, engine):
    _, artist, customer = await setup(client, engine)
    follow = f"{FEED}/artists/{artist['id']}/follow"

    assert (await client.put(follow, headers=customer)).json() == {"following": True}
    assert (await client.put(follow, headers=customer)).json() == {"following": True}
    assert (await client.delete(follow, headers=customer)).json() == {"following": False}
    unknown = "00000000-0000-0000-0000-000000000000"
    assert (await client.put(f"{FEED}/artists/{unknown}/follow", headers=customer)).status_code == 404


async def test_artist_deletes_only_their_own_post(client, engine):
    admin, artist, customer = await setup(client, engine)
    rival = await approved_artist(client, engine, "+919845091002", admin, name="Meher by Riya")
    p = (await photo_post(client, artist)).json()

    assert (await client.delete(f"{MINE}/{p['id']}", headers=rival["headers"])).status_code == 404
    assert (await client.delete(f"{MINE}/{p['id']}", headers=artist["headers"])).status_code == 204
    assert (await client.get(FEED, headers=customer)).json()["items"] == []


async def test_posting_is_rate_limited(client, engine, override):
    _, artist, _ = await setup(client, engine)
    override(posts_per_user, lambda: Limit(hits=1, window_seconds=3600))

    assert (await photo_post(client, artist)).status_code == 201
    assert (await photo_post(client, artist)).status_code == 429


async def test_captions_have_their_own_length_limit(client, engine):
    _, artist, _ = await setup(client, engine)

    assert (await photo_post(client, artist, caption="a " * 1200)).status_code == 422


def test_excerpt_skips_headings_and_cuts_long_paragraphs_at_a_word():
    body = "## Before you start\n\n" + "henna " * 60 + "\n\nLater paragraph."

    cut = excerpt(body)

    assert cut.startswith("henna henna") and cut.endswith("…")
    assert len(cut) <= 201 and not cut[:-1].endswith(" ")
    assert read_minutes("word " * 401) == 3


async def test_fields_must_fit_the_kind_and_images_belong_to_one_post(client, engine):
    _, artist, _ = await setup(client, engine)
    key = await upload_key(client, artist["headers"], "post")
    photo = {"key": key, "width": 10, "height": 10}

    cover_on_photos = await client.post(
        MINE, headers=artist["headers"], json={"kind": "photos", "text": "x", "photos": [photo], "cover": photo}
    )
    photos_on_article = await client.post(
        MINE, headers=artist["headers"], json={"kind": "article", "title": "Title", "text": "x", "photos": [photo]}
    )
    duplicate = await client.post(
        MINE, headers=artist["headers"], json={"kind": "photos", "text": "x", "photos": [photo, photo]}
    )
    first = await client.post(MINE, headers=artist["headers"], json={"kind": "photos", "text": "x", "photos": [photo]})
    reused = await client.post(
        MINE, headers=artist["headers"], json={"kind": "article", "title": "Title", "text": "x", "cover": photo}
    )

    assert [r.status_code for r in (cover_on_photos, photos_on_article, duplicate)] == [422, 422, 422]
    assert first.status_code == 201
    assert reused.status_code == 409


async def test_like_counts_stay_exact_through_repeats(client, engine):
    _, artist, customer = await setup(client, engine)
    p = (await photo_post(client, artist)).json()
    like = f"{FEED}/posts/{p['id']}/like"

    for _ in range(3):
        await client.put(like, headers=customer)
    await client.delete(like, headers=customer)
    after = await client.delete(like, headers=customer)

    assert after.json() == {"liked": False, "like_count": 0}
    assert (await client.get(f"{FEED}/posts/{p['id']}", headers=customer)).json()["like_count"] == 0


async def test_a_linked_service_that_is_no_longer_approved_is_not_shown(client, engine):
    _, artist, customer = await setup(client, engine)
    p = (await photo_post(client, artist, service_id=artist["service_id"])).json()
    async with engine.begin() as conn:
        await conn.execute(
            text("UPDATE artist_service_item SET status='rejected' WHERE id=:id"), {"id": artist["service_id"]}
        )

    assert (await client.get(f"{FEED}/posts/{p['id']}", headers=customer)).json()["service"] is None
