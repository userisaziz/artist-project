"""Package photos: an artist can give each service its own photo, which customers see on the storefront.
Only the artist's own "service" uploads are accepted; a replaced or removed photo's file is deleted."""

import pytest_asyncio

from app.upload.service import FakeStorage
from tests.support.artist import complete_profile
from tests.support.auth import admin_headers, sign_in
from tests.support.catalog import seed_categories
from tests.support.upload import upload_key

ARTIST_PHONE = "+919845077711"
SERVICES = "/api/v1/artists/me/services"


@pytest_asyncio.fixture(autouse=True)
async def catalog_seeded(engine):
    await seed_categories(engine)


async def test_a_package_photo_shows_on_the_storefront(client, engine):
    headers = await sign_in(client, ARTIST_PHONE)
    key = await upload_key(client, headers, "service")
    profile = await complete_profile(client, headers, service={"photo_key": key})
    assert (await client.post("/api/v1/artists/me/submit", headers=headers)).status_code == 200
    admin = await admin_headers(client, engine)
    assert (await client.post(f"/api/v1/admin/artists/{profile['id']}/approve", headers=admin)).status_code == 200

    public = (await client.get(f"/api/v1/artists/{profile['id']}")).json()

    assert profile["services"][0]["photo_url"] == f"https://fake.storage/card/{key}.jpg"
    assert public["services"][0]["photo_url"] == f"https://fake.storage/card/{key}.jpg"


async def test_a_package_photo_must_be_the_artists_own_service_upload(client, engine):
    headers = await sign_in(client, ARTIST_PHONE)
    service_id = (await complete_profile(client, headers))["services"][0]["id"]
    portfolio_key = await upload_key(client, headers, "portfolio")
    someone_elses = await upload_key(client, await sign_in(client, "+919845077712"), "service")

    wrong_purpose = await client.patch(f"{SERVICES}/{service_id}", headers=headers, json={"photo_key": portfolio_key})
    not_theirs = await client.patch(f"{SERVICES}/{service_id}", headers=headers, json={"photo_key": someone_elses})

    assert (wrong_purpose.status_code, not_theirs.status_code) == (422, 422)


async def test_replacing_or_removing_a_package_photo_deletes_the_old_file(client, engine):
    headers = await sign_in(client, ARTIST_PHONE)
    service_id = (await complete_profile(client, headers))["services"][0]["id"]
    first, second = await upload_key(client, headers, "service"), await upload_key(client, headers, "service")
    url = f"{SERVICES}/{service_id}"

    await client.patch(url, headers=headers, json={"photo_key": first})
    replaced = await client.patch(url, headers=headers, json={"photo_key": second})
    kept = await client.patch(url, headers=headers, json={"price_paise": 600000})  # photo left out: it stays
    removed = await client.patch(url, headers=headers, json={"photo_key": None})

    assert replaced.json()["services"][0]["photo_url"].endswith(f"{second}.jpg")
    assert kept.json()["services"][0]["photo_url"].endswith(f"{second}.jpg")
    assert removed.json()["services"][0]["photo_url"] is None
    assert {first, second} <= set(FakeStorage.deleted)


async def test_deleting_a_package_deletes_its_photo(client, engine):
    headers = await sign_in(client, ARTIST_PHONE)
    service_id = (await complete_profile(client, headers))["services"][0]["id"]
    key = await upload_key(client, headers, "service")
    await client.patch(f"{SERVICES}/{service_id}", headers=headers, json={"photo_key": key})

    deleted = await client.delete(f"{SERVICES}/{service_id}", headers=headers)

    assert deleted.status_code == 200
    assert key in FakeStorage.deleted


async def test_deleting_the_account_deletes_package_photos(client, engine):
    headers = await sign_in(client, ARTIST_PHONE)
    key = await upload_key(client, headers, "service")
    await complete_profile(client, headers, service={"photo_key": key})

    assert (await client.delete("/api/v1/users/me", headers=headers)).status_code == 204

    assert key in FakeStorage.deleted
