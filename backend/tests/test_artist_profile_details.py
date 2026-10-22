"""Profile details for the storefront: years of experience and the languages an artist speaks.
Both are set on the Profile step (PUT /artists/me/profile replaces them like every other field) and are public."""

import pytest_asyncio

from tests.support.artist import complete_profile
from tests.support.auth import admin_headers, sign_in
from tests.support.catalog import categories, seed_categories

ARTIST_PHONE = "+919845077721"
PROFILE = "/api/v1/artists/me/profile"


@pytest_asyncio.fixture(autouse=True)
async def catalog_seeded(engine):
    await seed_categories(engine)


async def profile_body(client, **details) -> dict:
    mehendi = (await categories(client))["mehendi"]
    return {"business_name": "Ayesha Mehendi Art", "city": "Bangalore", "category_ids": [mehendi], **details}


async def test_experience_and_languages_are_saved_once_each_in_order(client, engine):
    headers = await sign_in(client, ARTIST_PHONE)
    body = await profile_body(client, experience_years=8, languages=["Hindi", "English", "Kannada", "Hindi"])

    saved = await client.put(PROFILE, headers=headers, json=body)

    assert saved.status_code == 200, saved.text
    me = (await client.get("/api/v1/artists/me", headers=headers)).json()
    assert (me["experience_years"], me["languages"]) == (8, ["Hindi", "English", "Kannada"])


async def test_details_are_optional_and_validated(client, engine):
    headers = await sign_in(client, ARTIST_PHONE)

    bare = await client.put(PROFILE, headers=headers, json=await profile_body(client))
    unknown = await client.put(PROFILE, headers=headers, json=await profile_body(client, languages=["Klingon"]))
    too_long = await client.put(PROFILE, headers=headers, json=await profile_body(client, experience_years=61))
    negative = await client.put(PROFILE, headers=headers, json=await profile_body(client, experience_years=-1))

    assert bare.status_code == 200
    assert (bare.json()["experience_years"], bare.json()["languages"]) == (None, [])
    assert (unknown.status_code, too_long.status_code, negative.status_code) == (422, 422, 422)


async def test_customers_see_experience_and_languages_on_the_storefront(client, engine):
    headers = await sign_in(client, ARTIST_PHONE)
    profile = await complete_profile(client, headers)
    body = await profile_body(
        client, photo_key=profile["photo_key"], experience_years=12, languages=["Tamil", "English"]
    )
    assert (await client.put(PROFILE, headers=headers, json=body)).status_code == 200
    assert (await client.post("/api/v1/artists/me/submit", headers=headers)).status_code == 200
    admin = await admin_headers(client, engine)
    assert (await client.post(f"/api/v1/admin/artists/{profile['id']}/approve", headers=admin)).status_code == 200

    public = (await client.get(f"/api/v1/artists/{profile['id']}")).json()

    assert (public["experience_years"], public["languages"]) == (12, ["Tamil", "English"])
