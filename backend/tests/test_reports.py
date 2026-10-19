"""Reports: booking KPIs for a period and on-demand CSV exports. Phase 1 takes no in-app payments, so nothing
here reports revenue, commission or payouts; booking value is what the booking was worth."""

import csv
import io

import pytest_asyncio

from tests.support.artist import approved_artist
from tests.support.booking import at, book, setup
from tests.support.catalog import seed_categories
from tests.support.directory import slot

REPORTS = "/api/v1/admin/reports"


@pytest_asyncio.fixture(autouse=True)
async def categories_seeded(engine):
    await seed_categories(engine)


def rows(response) -> list[dict]:
    assert response.status_code == 200, response.text
    assert response.headers["content-type"].startswith("text/csv")
    return list(csv.DictReader(io.StringIO(response.text)))


async def complete(client, artist, customer, travel, day):
    b = (await book(client, customer, artist, slot(day, 11))).json()
    await client.post(f"/api/v1/artists/me/bookings/{b['id']}/accept", headers=artist["headers"])
    travel(at(b["start_at"], 4))
    await client.post(f"/api/v1/artists/me/bookings/{b['id']}/complete", headers=artist["headers"])
    travel.back()
    return b


async def test_summary_counts_bookings_completion_and_top_city_and_category(client, engine, travel):
    admin, artist, customer = await setup(client, engine)
    mumbai = await approved_artist(client, engine, "+919845091002", admin, name="Meher by Riya", city="Mumbai")
    await complete(client, artist, customer, travel, 5)
    await book(client, customer, artist, slot(6, 11))
    await book(client, customer, mumbai, slot(7, 11))

    s = (await client.get(f"{REPORTS}/summary", headers=admin, params={"period": "30d"})).json()

    assert (s["bookings"], s["completed"]) == (3, 1)
    assert s["completion_rate"] == round(1 / 3, 3)
    assert s["top_city"] == {"name": "Bangalore", "share": round(2 / 3, 3)}
    assert s["top_category"]["name"] == "Mehendi"
    assert "gmv" not in str(s).lower() and "revenue" not in str(s).lower()


async def test_bookings_export_lists_every_booking_in_the_period(client, engine):
    admin, artist, customer = await setup(client, engine)
    b = (await book(client, customer, artist)).json()

    out = rows(await client.get(f"{REPORTS}/bookings.csv", headers=admin, params={"period": "7d"}))

    assert [r["code"] for r in out] == [b["code"]]
    assert set(out[0]) >= {
        "code",
        "status",
        "service",
        "artist",
        "city",
        "customer_phone",
        "start_at",
        "booking_value_inr",
    }
    assert out[0]["booking_value_inr"] == "5599.00"


async def test_grouped_exports_by_city_category_and_week(client, engine):
    admin, artist, customer = await setup(client, engine)
    mumbai = await approved_artist(client, engine, "+919845091002", admin, name="Meher by Riya", city="Mumbai")
    await book(client, customer, artist, slot(5, 11))
    await book(client, customer, mumbai, slot(6, 11))

    by_city = rows(await client.get(f"{REPORTS}/bookings_by_city.csv", headers=admin))
    by_category = rows(await client.get(f"{REPORTS}/bookings_by_category.csv", headers=admin))
    by_week = rows(await client.get(f"{REPORTS}/bookings_by_week.csv", headers=admin))

    assert {(r["city"], r["bookings"]) for r in by_city} == {("Bangalore", "1"), ("Mumbai", "1")}
    assert by_category[0]["category"] == "Mehendi" and by_category[0]["bookings"] == "2"
    assert sum(int(r["bookings"]) for r in by_week) == 2


async def test_artists_reviews_and_support_exports(client, engine):
    admin, _, customer = await setup(client, engine)
    await client.post("/api/v1/support/tickets", headers=customer, json={"topic": "account", "issue": "cant_log_in"})

    artists = rows(await client.get(f"{REPORTS}/artists.csv", headers=admin, params={"period": "all"}))
    reviews = rows(await client.get(f"{REPORTS}/reviews.csv", headers=admin, params={"period": "all"}))
    tickets = rows(await client.get(f"{REPORTS}/support_tickets.csv", headers=admin, params={"period": "all"}))

    assert [a["business_name"] for a in artists] == ["Ayesha Mehendi Art"]
    assert reviews == []
    assert [t["subject"] for t in tickets] == ["Can't log in"]


async def test_unknown_reports_and_periods_are_refused(client, engine):
    admin, _, customer = await setup(client, engine)

    assert (await client.get(f"{REPORTS}/payouts.csv", headers=admin)).status_code == 404
    assert (await client.get(f"{REPORTS}/summary", headers=admin, params={"period": "5y"})).status_code == 422
    assert (await client.get(f"{REPORTS}/summary", headers=customer)).status_code == 403
