"""Artist onboarding support: build, submit, and approve the canonical test artist."""

from tests.support.auth import sign_in
from tests.support.catalog import area_id, categories, templates
from tests.support.upload import upload_key


async def add_kyc(client, headers) -> None:
    """Identity step with a generated (not real) Aadhaar number."""
    response = await client.put(
        "/api/v1/artists/me/kyc",
        headers=headers,
        json={
            "aadhaar_number": "234123412346",
            "front_key": await upload_key(client, headers, "aadhaar"),
            "back_key": await upload_key(client, headers, "aadhaar"),
        },
    )
    assert response.status_code == 200


async def complete_profile(client, headers, photos: int = 6, kyc: bool = True, service: dict | None = None) -> dict:
    """A submittable profile: photo, name, category, city, location, one service, `photos` portfolio photos.
    `service` adds fields to that service (e.g. included_items, addons)."""
    cats = await categories(client)
    await client.put(
        "/api/v1/artists/me/profile",
        headers=headers,
        json={
            "business_name": "Ayesha Mehendi Art",
            "city": "Bangalore",
            "category_ids": [cats["mehendi"]],
            "photo_key": await upload_key(client, headers, "artist_photo"),
        },
    )
    koramangala = await area_id(client, "Bangalore", "Koramangala")
    await client.put("/api/v1/artists/me/location", headers=headers, json={"area_id": koramangala, "pincode": "560095"})
    await client.post(
        "/api/v1/artists/me/services",
        headers=headers,
        json={
            "template_id": (await templates(client))["Bridal Classic"],
            "price_paise": 550000,
            "duration_minutes": 180,
            **(service or {}),
        },
    )
    for _ in range(photos):
        key = await upload_key(client, headers, "portfolio")
        await client.post(
            "/api/v1/artists/me/photos", headers=headers, json={"key": key, "width": 1200, "height": 1500}
        )
    if kyc:
        await add_kyc(client, headers)
    return (await client.get("/api/v1/artists/me", headers=headers)).json()


async def submitted_artist(client, engine, phone: str) -> dict:
    headers = await sign_in(client, phone)
    await complete_profile(client, headers)
    await client.post("/api/v1/artists/me/submit", headers=headers)
    return headers


async def submitted_artist_id(client, phone="+919845066601") -> str:
    headers = await sign_in(client, phone, role="artist")
    await complete_profile(client, headers)
    assert (await client.post("/api/v1/artists/me/submit", headers=headers)).status_code == 200
    return (await client.get("/api/v1/artists/me", headers=headers)).json()["id"]


async def approved_artist(
    client,
    engine,
    phone: str,
    admin: dict,
    name: str = "Ayesha Mehendi Art",
    city: str = "Bangalore",
    service: dict | None = None,
) -> dict:
    """An approved artist with one service, Bridal Classic at ₹5,500 for 3 h (plus `service` fields).
    Returns headers, ids and that service."""
    headers = await sign_in(client, phone)
    profile = await complete_profile(client, headers, service=service)
    cats = await categories(client)
    await client.put(
        "/api/v1/artists/me/profile",
        headers=headers,
        json={
            "business_name": name,
            "city": city,
            "category_ids": [cats["mehendi"]],
            "photo_key": profile["photo_key"],
        },
    )
    assert (await client.post("/api/v1/artists/me/submit", headers=headers)).status_code == 200
    assert (await client.post(f"/api/v1/admin/artists/{profile['id']}/approve", headers=admin)).status_code == 200
    return {
        "headers": headers,
        "id": profile["id"],
        "service_id": profile["services"][0]["id"],
        "service": profile["services"][0],
    }
