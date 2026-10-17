"""Artist identity step: Aadhaar number (encrypted) and card photos (private storage)."""

import pytest_asyncio
from sqlalchemy import text

from app.core.crypto import decrypt_aadhaar
from app.upload.service import FakeStorage
from tests.support.artist import complete_profile
from tests.support.auth import sign_in
from tests.support.catalog import seed_categories
from tests.support.upload import upload_key

PHONE = "+919845055501"


@pytest_asyncio.fixture(autouse=True)
async def categories_seeded(engine):
    await seed_categories(engine)


async def kyc_body(client, headers, number="234123412346") -> dict:
    return {
        "aadhaar_number": number,
        "front_key": await upload_key(client, headers, "aadhaar"),
        "back_key": await upload_key(client, headers, "aadhaar"),
    }


async def test_save_kyc_encrypts_and_returns_only_last4(client, engine):
    headers = await sign_in(client, PHONE)
    await complete_profile(client, headers, kyc=False)
    response = await client.put("/api/v1/artists/me/kyc", headers=headers, json=await kyc_body(client, headers, "2341 2341 2346"))
    assert response.status_code == 200
    body = response.json()
    assert body["kyc"] == {"aadhaar_last4": "2346"}
    assert "234123412346" not in response.text and "aadhaar/" not in response.text  # no number, no keys, no URLs
    async with engine.connect() as conn:
        row = (await conn.execute(text("SELECT aadhaar_encrypted, aadhaar_last4 FROM artist_kyc"))).one()
    assert row.aadhaar_last4 == "2346"
    assert "234123412346" not in row.aadhaar_encrypted
    assert decrypt_aadhaar(row.aadhaar_encrypted) == "234123412346"
    me = (await client.get("/api/v1/artists/me", headers=headers)).json()
    assert me["kyc"] == {"aadhaar_last4": "2346"}


async def test_kyc_rejects_bad_numbers_and_keys(client):
    headers = await sign_in(client, PHONE)
    await complete_profile(client, headers, kyc=False)
    bad = await client.put("/api/v1/artists/me/kyc", headers=headers, json=await kyc_body(client, headers, "234123412347"))
    assert bad.status_code == 422
    assert bad.json() == {"code": "validation_error", "message": "Invalid Aadhaar number"}

    other = await sign_in(client, "+919845055502")
    foreign = await upload_key(client, other, "aadhaar")
    body = await kyc_body(client, headers)
    response = await client.put("/api/v1/artists/me/kyc", headers=headers, json={**body, "front_key": foreign})
    assert response.status_code == 422 and response.json()["message"] == "Invalid photo key"

    wrong_purpose = await upload_key(client, headers, "portfolio")
    response = await client.put("/api/v1/artists/me/kyc", headers=headers, json={**body, "back_key": wrong_purpose})
    assert response.status_code == 422 and response.json()["message"] == "Invalid photo key"

    same = await client.put("/api/v1/artists/me/kyc", headers=headers, json={**body, "back_key": body["front_key"]})
    assert same.status_code == 422 and same.json()["message"] == "Front and back must be different photos"


async def test_kyc_needs_a_profile_and_an_editable_one(client):
    headers = await sign_in(client, PHONE)
    no_profile = await client.put("/api/v1/artists/me/kyc", headers=headers, json=await kyc_body(client, headers))
    assert no_profile.status_code == 404

    await complete_profile(client, headers)  # includes kyc
    assert (await client.post("/api/v1/artists/me/submit", headers=headers)).status_code == 200
    locked = await client.put("/api/v1/artists/me/kyc", headers=headers, json=await kyc_body(client, headers))
    assert locked.status_code == 409


async def test_replacing_kyc_deletes_old_private_files(client):
    headers = await sign_in(client, PHONE)
    await complete_profile(client, headers, kyc=False)
    first = await kyc_body(client, headers)
    await client.put("/api/v1/artists/me/kyc", headers=headers, json=first)
    FakeStorage.deleted.clear()
    second = await kyc_body(client, headers, "498765432102")
    response = await client.put("/api/v1/artists/me/kyc", headers=headers, json=second)
    assert response.json()["kyc"] == {"aadhaar_last4": "2102"}
    assert set(FakeStorage.deleted) == {first["front_key"], first["back_key"]}


async def test_submit_requires_kyc(client):
    headers = await sign_in(client, PHONE)
    await complete_profile(client, headers, kyc=False)
    response = await client.post("/api/v1/artists/me/submit", headers=headers)
    assert response.status_code == 422
    assert response.json()["missing"] == ["kyc"]


async def test_aadhaar_upload_ticket_is_artist_only(client):
    headers = await sign_in(client, "+919845055503", role="customer")
    response = await client.post("/api/v1/uploads/signature", headers=headers, json={"purpose": "aadhaar"})
    assert response.status_code == 403
