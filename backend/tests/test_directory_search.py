"""Explore search: filters (rating, price, home visit, a free date, near a point), sorts, totals and the richer card."""

import pytest_asyncio
from sqlalchemy import text

from tests.support.artist import approved_artist
from tests.support.auth import CUSTOMER_PHONE, admin_headers, sign_in
from tests.support.booking import at, book
from tests.support.catalog import seed_categories
from tests.support.directory import ist_day, slot

KORAMANGALA = (12.9352, 77.6245)
JAYANAGAR = (12.9250, 77.5938)  # ~3.5 km from Koramangala
INDIRANAGAR = (12.9784, 77.6408)  # ~5 km from Koramangala


@pytest_asyncio.fixture(autouse=True)
async def categories_seeded(engine):
    await seed_categories(engine)


async def sql(engine, statement: str, **params) -> None:
    async with engine.begin() as conn:
        await conn.execute(text(statement), params)


async def place(engine, artist: dict, point: tuple[float, float]) -> None:
    await sql(
        engine,
        "update artist_profile set latitude = :lat, longitude = :lng where id = :id",
        lat=point[0],
        lng=point[1],
        id=artist["id"],
    )


async def price(engine, artist: dict, paise: int) -> None:
    await sql(
        engine, "update artist_service_item set price_paise = :p where id = :id", p=paise, id=artist["service_id"]
    )


async def reviewed(client, artist: dict, customer: dict, travel, rating: int, day: int = 5) -> None:
    booking = (await book(client, customer, artist, slot(day, 11))).json()
    await client.post(f"/api/v1/artists/me/bookings/{booking['id']}/accept", headers=artist["headers"])
    travel(at(booking["start_at"], 4))
    await client.post(f"/api/v1/artists/me/bookings/{booking['id']}/complete", headers=artist["headers"])
    response = await client.post(
        f"/api/v1/bookings/{booking['id']}/review", headers=customer, json={"rating": rating, "text": "Lovely"}
    )
    assert response.status_code == 201, response.text


async def search(client, query: str = "") -> dict:
    response = await client.get(f"/api/v1/artists{query}")
    assert response.status_code == 200, response.text
    return response.json()


def names(body: dict) -> list[str]:
    return [a["business_name"] for a in body["items"]]


async def test_cards_carry_area_photos_and_a_total(client, engine):
    admin = await admin_headers(client, engine)
    await approved_artist(client, engine, "+919845071001", admin)

    body = await search(client)
    card = body["items"][0]
    assert card["locality"] == "Koramangala"
    assert len(card["photo_urls"]) == 3 and all(u.startswith("https://fake.storage/card/") for u in card["photo_urls"])
    assert (card["distance_km"], card["free_on"]) == (None, None)
    assert body["total"] == 1
    assert "pincode" not in card and "address_line" not in card  # the address never goes public


async def test_rating_price_and_home_visit_filters_with_sorts(client, engine, travel):
    admin = await admin_headers(client, engine)
    ayesha = await approved_artist(client, engine, "+919845071001", admin, name="Ayesha")
    noor = await approved_artist(client, engine, "+919845071002", admin, name="Noor")
    zoya = await approved_artist(client, engine, "+919845071003", admin, name="Zoya")
    customer = await sign_in(client, CUSTOMER_PHONE, role="customer")
    await reviewed(client, ayesha, customer, travel, rating=5)
    await reviewed(client, noor, customer, travel, rating=3, day=6)
    await price(engine, ayesha, 300000)
    await price(engine, zoya, 150000)
    await sql(engine, "update artist_profile set travel_radius_km = 10 where id = :id", id=noor["id"])

    rated = await search(client, "?min_rating=4.8")
    assert (names(rated), rated["total"]) == (["Ayesha"], 1)
    assert sorted(names(await search(client, "?max_price_paise=300000"))) == ["Ayesha", "Zoya"]
    assert names(await search(client, "?home_visit=true")) == ["Noor"]
    assert names(await search(client, "?sort=rating")) == ["Ayesha", "Noor", "Zoya"]  # unrated last
    assert names(await search(client, "?sort=price")) == ["Zoya", "Ayesha", "Noor"]
    assert names(await search(client, "?sort=recommended"))[0] == "Ayesha"


async def test_sorted_results_page_with_an_opaque_cursor(client, engine):
    admin = await admin_headers(client, engine)
    for i, paise in enumerate([300000, 100000, 200000]):
        artist = await approved_artist(client, engine, f"+91984507200{i}", admin, name=f"A{paise}")
        await price(engine, artist, paise)

    first = await search(client, "?sort=price&limit=2")
    assert (names(first), first["total"]) == (["A100000", "A200000"], 3)
    rest = await search(client, f"?sort=price&limit=2&cursor={first['next_cursor']}")
    assert (names(rest), rest["next_cursor"]) == (["A300000"], None)
    assert (await client.get("/api/v1/artists?sort=price&cursor=not-a-cursor")).status_code == 422


async def test_near_a_point_sorts_by_distance_and_shows_it(client, engine):
    admin = await admin_headers(client, engine)
    far = await approved_artist(client, engine, "+919845073001", admin, name="Indiranagar")
    near = await approved_artist(client, engine, "+919845073002", admin, name="Jayanagar")
    await approved_artist(client, engine, "+919845073003", admin, name="Unplaced")
    await place(engine, far, INDIRANAGAR)
    await place(engine, near, JAYANAGAR)

    body = await search(client, f"?sort=nearest&near_lat={KORAMANGALA[0]}&near_lng={KORAMANGALA[1]}")
    assert names(body) == ["Jayanagar", "Indiranagar", "Unplaced"]  # artists without a pin come last
    distances = [a["distance_km"] for a in body["items"]]
    assert 3 <= distances[0] <= 4 and 4.5 <= distances[1] <= 6 and distances[2] is None

    assert (await client.get("/api/v1/artists?sort=nearest")).status_code == 422  # needs a point
    assert (await client.get("/api/v1/artists?near_lat=91&near_lng=77")).status_code == 422
    assert (await client.get("/api/v1/artists?near_lat=12.9")).status_code == 422  # both or neither


async def test_available_on_keeps_artists_with_a_free_slot_that_day(client, engine):
    admin = await admin_headers(client, engine)
    free = await approved_artist(client, engine, "+919845074001", admin, name="Free")
    away = await approved_artist(client, engine, "+919845074002", admin, name="Away")
    day = ist_day(5)
    taken = await client.put(f"/api/v1/artists/me/schedule/days-off/{day}", headers=away["headers"])
    assert taken.status_code == 200

    body = await search(client, f"?available_on={day}")
    assert names(body) == ["Free"]
    assert body["items"][0]["free_on"] == day.isoformat()
    assert body["total"] is None  # not counted: checking every artist's slots is too costly
    assert free["id"] == body["items"][0]["id"]
