"""Public artist directory: who customers can find, what they see, and which slots are free."""

import uuid
from datetime import datetime, timedelta

import pytest_asyncio
from sqlalchemy import text

from app.shared import clock
from tests.support.artist import approved_artist, complete_profile
from tests.support.auth import CUSTOMER_PHONE, admin_headers, sign_in
from tests.support.catalog import categories, seed_categories
from tests.support.directory import IST, ist_day, slot


@pytest_asyncio.fixture(autouse=True)
async def categories_seeded(engine):
    await seed_categories(engine)


async def test_directory_lists_only_approved_artists(client, engine):
    admin = await admin_headers(client, engine)
    ayesha = await approved_artist(client, engine, "+919845081001", admin)
    await complete_profile(client, await sign_in(client, "+919845081002"))  # a draft: never listed

    body = (await client.get("/api/v1/artists")).json()
    assert [a["id"] for a in body["items"]] == [ayesha["id"]]
    card = body["items"][0]
    assert card["business_name"] == "Ayesha Mehendi Art"
    assert card["city"] == "Bangalore"
    assert card["from_price_paise"] == 550000
    assert card["categories"] == [{"id": (await categories(client))["mehendi"], "name": "Mehendi"}]
    assert card["cover_url"].startswith("https://fake.storage/card/")
    assert card["photo_url"].startswith("https://fake.storage/card/")
    assert set(card) == {
        "id",
        "business_name",
        "city",
        "photo_url",
        "cover_url",
        "categories",
        "from_price_paise",
        "rating",
        "review_count",
    }
    assert (card["rating"], card["review_count"]) == (None, 0)
    assert body["next_cursor"] is None


async def test_directory_filters_and_pages(client, engine):
    admin = await admin_headers(client, engine)
    ayesha = await approved_artist(client, engine, "+919845081001", admin)
    noor = await approved_artist(client, engine, "+919845081002", admin, name="Henna by Noor", city="Pune")
    cats = await categories(client)

    async def ids(query: str) -> list[str]:
        return [a["id"] for a in (await client.get(f"/api/v1/artists{query}")).json()["items"]]

    assert await ids("?city=Pune") == [noor["id"]]
    assert await ids("?q=henna") == [noor["id"]]
    assert set(await ids("?q=bridal classic")) == {ayesha["id"], noor["id"]}  # service names match too
    assert await ids(f"?category_id={cats['makeup']}") == []
    assert set(await ids(f"?category_id={cats['mehendi']}")) == {ayesha["id"], noor["id"]}

    first = (await client.get("/api/v1/artists?limit=1")).json()
    assert first["items"][0]["id"] == noor["id"]  # most recently approved first
    second = (await client.get(f"/api/v1/artists?limit=1&cursor={first['next_cursor']}")).json()
    assert [a["id"] for a in second["items"]] == [ayesha["id"]]
    assert second["next_cursor"] is None


async def test_artist_detail_shows_only_public_parts(client, engine):
    admin = await admin_headers(client, engine)
    ayesha = await approved_artist(client, engine, "+919845081001", admin)
    cats = await categories(client)
    sub = next(c for c in (await client.get("/api/v1/categories")).json() if c["slug"] == "makeup")["subcategories"][0]
    pending = await client.post(
        "/api/v1/artists/me/custom-services",
        headers=ayesha["headers"],
        json={
            "subcategory_id": sub["id"],
            "name": "Glitter add-on",
            "price_paise": 50000,
            "duration_minutes": 30,
        },
    )
    assert pending.status_code == 201

    detail = (await client.get(f"/api/v1/artists/{ayesha['id']}")).json()
    assert [s["name"] for s in detail["services"]] == ["Bridal Classic"]  # the pending custom one stays hidden
    service = detail["services"][0]
    assert service["category"] == {"id": cats["mehendi"], "name": "Mehendi"}
    assert service["subcategory"]["name"] == "Bridal"
    assert len(detail["photos"]) == 6
    assert detail["completed_bookings"] == 0
    assert detail["member_since"] is not None
    for private in ("kyc", "rejection_reason", "owner", "status"):
        assert private not in detail

    draft = await complete_profile(client, await sign_in(client, "+919845081002"))
    assert (await client.get(f"/api/v1/artists/{draft['id']}")).status_code == 404
    assert (await client.get(f"/api/v1/artists/{uuid.uuid4()}")).status_code == 404


async def test_availability_blocks_overlapping_slots(client, engine):
    admin = await admin_headers(client, engine)
    ayesha = await approved_artist(client, engine, "+919845081001", admin)
    customer = await sign_in(client, CUSTOMER_PHONE, role="customer")
    booked = await client.post(
        "/api/v1/bookings",
        headers=customer,
        json={
            "artist_id": ayesha["id"],
            "service_id": ayesha["service_id"],
            "start_at": slot(5, 11),
            "address": "Koramangala",
        },
    )
    assert booked.status_code == 201

    day = ist_day(5)
    body = (
        await client.get(f"/api/v1/artists/{ayesha['id']}/availability?date={day}&service_id={ayesha['service_id']}")
    ).json()
    assert body["date"] == day.isoformat()
    hours = {datetime.fromisoformat(s["start_at"]).astimezone(IST).hour: s["available"] for s in body["slots"]}
    # A 3 h service: 09–12 and 10–13 run into the 11–14 booking; 14:00 onwards is free.
    assert hours == {9: False, 10: False, 11: False, 12: False, 13: False, 14: True, 15: True, 16: True, 17: True}


async def test_availability_respects_lead_time_and_range(client, engine, monkeypatch):
    admin = await admin_headers(client, engine)
    ayesha = await approved_artist(client, engine, "+919845081001", admin)
    today = ist_day(0)
    monkeypatch.setattr(clock, "now", lambda: datetime(today.year, today.month, today.day, 10, 30, tzinfo=IST))
    url = f"/api/v1/artists/{ayesha['id']}/availability?service_id={ayesha['service_id']}&date="

    slots = (await client.get(url + today.isoformat())).json()["slots"]
    free = [datetime.fromisoformat(s["start_at"]).astimezone(IST).hour for s in slots if s["available"]]
    assert free == [13, 14, 15, 16, 17]  # 12:00 is less than 2 h after 10:30

    assert (await client.get(url + (today - timedelta(days=1)).isoformat())).status_code == 422
    assert (await client.get(url + (today + timedelta(days=61)).isoformat())).status_code == 422
    assert (
        await client.get(f"/api/v1/artists/{ayesha['id']}/availability?date={today}&service_id={uuid.uuid4()}")
    ).status_code == 404


async def test_directory_hides_artists_and_services_admins_withdrew(client, engine):
    admin = await admin_headers(client, engine)
    ayesha = await approved_artist(client, engine, "+919845081001", admin)
    async with engine.begin() as conn:
        await conn.execute(text("UPDATE artist_profiles SET status='rejected' WHERE id=:i"), {"i": ayesha["id"]})
    assert (await client.get("/api/v1/artists")).json()["items"] == []
    assert (await client.get(f"/api/v1/artists/{ayesha['id']}")).status_code == 404
