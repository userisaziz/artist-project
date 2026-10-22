"""Admin artist directory: every non-draft artist with category, city, rating and booking figures; counts and
KPIs; suspend and reinstate. A suspended artist disappears from the storefront and can't take bookings."""

import pytest_asyncio

from tests.support.artist import approved_artist, submitted_artist_id
from tests.support.booking import at, book, setup
from tests.support.catalog import seed_categories
from tests.support.directory import slot

DIRECTORY = "/api/v1/admin/artists/directory"


@pytest_asyncio.fixture(autouse=True)
async def categories_seeded(engine):
    await seed_categories(engine)


async def completed(client, artist: dict, customer: dict, travel, day: int) -> dict:
    b = (await book(client, customer, artist, slot(day, 11))).json()
    await client.post(f"/api/v1/artists/me/bookings/{b['id']}/accept", headers=artist["headers"])
    travel(at(b["start_at"], 4))
    done = await client.post(f"/api/v1/artists/me/bookings/{b['id']}/complete", headers=artist["headers"])
    assert done.status_code == 200, done.text
    travel.back()
    return done.json()


async def test_directory_rows_carry_category_city_and_booking_figures(client, engine, travel):
    admin, artist, customer = await setup(client, engine)
    await submitted_artist_id(client, "+919845066602")
    await completed(client, artist, customer, travel, 5)

    page = (await client.get(DIRECTORY, headers=admin)).json()

    rows = {r["business_name"]: r for r in page["items"]}
    ayesha = rows["Ayesha Mehendi Art"]
    assert (ayesha["category"], ayesha["city"], ayesha["status"]) == ("Mehendi", "Bangalore", "approved")
    assert (ayesha["bookings_total"], ayesha["booking_value_30d"]) == (1, 559900)
    assert ayesha["rating_count"] == 0 and ayesha["rating_average"] is None
    assert ayesha["open_complaints"] is None  # no complaints system yet
    assert any(r["status"] == "pending" for r in page["items"])


async def test_status_filter_search_and_counts(client, engine):
    admin, artist, _ = await setup(client, engine)
    await submitted_artist_id(client, "+919845066602")
    await approved_artist(client, engine, "+919845091002", admin, name="Meher by Riya", city="Mumbai")
    await client.post(f"/api/v1/admin/artists/{artist['id']}/suspend", headers=admin, json={"reason": "Complaints"})

    suspended = (await client.get(DIRECTORY, headers=admin, params={"status": "suspended"})).json()["items"]
    mumbai = (await client.get(DIRECTORY, headers=admin, params={"city": "Mumbai"})).json()["items"]
    found = (await client.get(DIRECTORY, headers=admin, params={"q": "meher"})).json()["items"]
    summary = (await client.get(f"{DIRECTORY}/summary", headers=admin)).json()

    assert [r["business_name"] for r in suspended] == ["Ayesha Mehendi Art"]
    assert [r["business_name"] for r in mumbai] == ["Meher by Riya"]
    assert [r["business_name"] for r in found] == ["Meher by Riya"]
    assert summary["counts"] == {"all": 3, "approved": 1, "pending": 1, "suspended": 1, "on_hold": 0}
    assert summary["active_artists"] == 1


async def test_suspending_hides_the_artist_until_reinstated(client, engine):
    admin, artist, customer = await setup(client, engine)

    suspended = await client.post(
        f"/api/v1/admin/artists/{artist['id']}/suspend", headers=admin, json={"reason": "Fraud check"}
    )
    hidden = await client.get(f"/api/v1/artists/{artist['id']}", headers=customer)
    booking = await book(client, customer, artist)
    artist_side = await client.get("/api/v1/artists/me/bookings", headers=artist["headers"])
    reinstated = await client.post(f"/api/v1/admin/artists/{artist['id']}/reinstate", headers=admin)
    visible = await client.get(f"/api/v1/artists/{artist['id']}", headers=customer)

    assert suspended.status_code == 200, suspended.text
    assert (suspended.json()["status"], suspended.json()["suspension_reason"]) == ("suspended", "Fraud check")
    assert hidden.status_code == 404
    assert booking.status_code in (404, 409, 422)
    assert artist_side.status_code == 409
    assert (reinstated.json()["status"], reinstated.json()["suspension_reason"]) == ("approved", None)
    assert visible.status_code == 200


async def test_only_approved_artists_can_be_suspended_and_reasons_are_required(client, engine):
    admin, artist, _ = await setup(client, engine)
    pending = await submitted_artist_id(client, "+919845066602")

    assert (
        await client.post(f"/api/v1/admin/artists/{pending}/suspend", headers=admin, json={"reason": "x"})
    ).status_code == 409
    assert (
        await client.post(f"/api/v1/admin/artists/{artist['id']}/suspend", headers=admin, json={"reason": " "})
    ).status_code == 422
    assert (await client.post(f"/api/v1/admin/artists/{artist['id']}/reinstate", headers=admin)).status_code == 409


async def test_kpis_cover_ratings_response_time_and_at_risk(client, engine, travel):
    admin, artist, customer = await setup(client, engine)
    b = (await book(client, customer, artist, slot(5, 11))).json()
    await client.post(
        f"/api/v1/artists/me/bookings/{b['id']}/decline", headers=artist["headers"], json={"reason": None}
    )

    s = (await client.get(f"{DIRECTORY}/summary", headers=admin)).json()

    assert s["at_risk"] == 1  # 1 of 1 bookings declined in 30 days: over the 8% line
    assert s["median_response_minutes"] is not None
    assert (s["avg_rating"], s["total_reviews"]) == (None, 0)


async def test_directory_is_admin_only(client, engine):
    _, artist, customer = await setup(client, engine)

    assert (await client.get(DIRECTORY, headers=customer)).status_code == 403
    assert (
        await client.post(f"/api/v1/admin/artists/{artist['id']}/suspend", headers=customer, json={"reason": "x"})
    ).status_code == 403
