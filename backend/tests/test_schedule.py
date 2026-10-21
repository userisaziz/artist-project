"""Artist schedule: weekly working hours, days off and a display-only travel radius. Hours shape the public
slot grid and what can be booked; artists who never set hours work every day 08:00-20:00 IST."""

from datetime import datetime

import pytest_asyncio

from tests.support.artist import approved_artist
from tests.support.auth import CUSTOMER_PHONE, admin_headers, sign_in
from tests.support.booking import book, setup
from tests.support.catalog import seed_categories
from tests.support.directory import IST, ist_day, slot

SCHEDULE = "/api/v1/artists/me/schedule"
DEFAULT_WEEK = [{"weekday": d, "is_open": True, "open_hour": 8, "close_hour": 20} for d in range(7)]


@pytest_asyncio.fixture(autouse=True)
async def categories_seeded(engine):
    await seed_categories(engine)


def week(**changes: dict) -> list[dict]:
    """The default week with some weekdays changed, e.g. `week(**{"2": {"is_open": False}})`."""
    return [{**day, **changes.get(str(day["weekday"]), {})} for day in DEFAULT_WEEK]


async def free_hours(client, artist: dict, days: int) -> list[int]:
    url = f"/api/v1/artists/{artist['id']}/availability?date={ist_day(days)}&service_id={artist['service_id']}"
    response = await client.get(url)
    assert response.status_code == 200, response.text
    return [datetime.fromisoformat(s["start_at"]).astimezone(IST).hour for s in response.json()["slots"]]


async def save(client, artist: dict, hours: list[dict], radius: int | None = None):
    return await client.put(SCHEDULE, headers=artist["headers"], json={"hours": hours, "travel_radius_km": radius})


# --- defaults and editing ---------------------------------------------------------------------------


async def test_an_artist_without_hours_works_every_day_eight_to_eight(client, engine):
    _, artist, _ = await setup(client, engine)

    schedule = (await client.get(SCHEDULE, headers=artist["headers"])).json()

    assert schedule == {"hours": DEFAULT_WEEK, "days_off": [], "travel_radius_km": None}
    # A 3 h service: the first start is 08:00 and the last one still ends by 20:00.
    assert await free_hours(client, artist, 5) == list(range(8, 18))


async def test_hours_and_radius_round_trip(client, engine):
    _, artist, _ = await setup(client, engine)
    hours = week(**{"0": {"open_hour": 10, "close_hour": 18}, "6": {"is_open": False}})

    saved = await save(client, artist, list(reversed(hours)), radius=15)

    assert saved.status_code == 200, saved.text
    assert saved.json() == {"hours": hours, "days_off": [], "travel_radius_km": 15}
    assert (await client.get(SCHEDULE, headers=artist["headers"])).json() == saved.json()
    cleared = await save(client, artist, hours, radius=None)
    assert cleared.json()["travel_radius_km"] is None


async def test_hours_are_validated(client, engine):
    _, artist, _ = await setup(client, engine)
    duplicate = [*DEFAULT_WEEK[:6], {**DEFAULT_WEEK[0]}]
    invalid = [
        {"hours": DEFAULT_WEEK[:6]},
        {"hours": [*DEFAULT_WEEK, {**DEFAULT_WEEK[0]}]},
        {"hours": duplicate},
        {"hours": week(**{"1": {"open_hour": 12, "close_hour": 12}})},
        {"hours": week(**{"1": {"open_hour": 14, "close_hour": 9, "is_open": False}})},
        {"hours": week(**{"1": {"open_hour": 24, "close_hour": 24}})},
        {"hours": week(**{"1": {"open_hour": 0, "close_hour": 25}})},
        {"hours": week(**{"1": {"weekday": 7}})},
        {"hours": DEFAULT_WEEK, "travel_radius_km": 0},
        {"hours": DEFAULT_WEEK, "travel_radius_km": 101},
    ]
    for body in invalid:
        response = await client.put(SCHEDULE, headers=artist["headers"], json=body)
        assert response.status_code == 422, body
    assert (await save(client, artist, week(**{"1": {"open_hour": 0, "close_hour": 24}}), 100)).status_code == 200


async def test_only_the_artist_edits_their_own_schedule(client, engine):
    admin, artist, customer = await setup(client, engine)
    other = await approved_artist(client, engine, "+919845091002", admin, name="Other Artist")

    assert (await client.get(SCHEDULE, headers=customer)).status_code == 403
    assert (await client.put(SCHEDULE, headers=customer, json={"hours": DEFAULT_WEEK})).status_code == 403
    assert (await client.put(f"{SCHEDULE}/days-off/{ist_day(5)}", headers=customer)).status_code == 403
    assert (await client.get(SCHEDULE)).status_code == 401

    await save(client, other, week(**{"0": {"is_open": False}}), radius=40)
    await client.put(f"{SCHEDULE}/days-off/{ist_day(5)}", headers=other["headers"])

    mine = (await client.get(SCHEDULE, headers=artist["headers"])).json()
    assert mine == {"hours": DEFAULT_WEEK, "days_off": [], "travel_radius_km": None}


async def test_an_artist_without_a_profile_has_no_schedule(client, engine):
    headers = await sign_in(client, "+919845091009")
    assert (await client.get(SCHEDULE, headers=headers)).status_code == 404


# --- hours shape the slot grid and bookings ---------------------------------------------------------------


async def test_availability_follows_the_hours_for_that_weekday(client, engine):
    _, artist, customer = await setup(client, engine)
    weekday = ist_day(5).weekday()
    await save(client, artist, week(**{str(weekday): {"open_hour": 10, "close_hour": 15}}))

    # 3 h service, open 10-15: 12:00 is the last start that ends by closing.
    assert await free_hours(client, artist, 5) == [10, 11, 12]
    assert (await book(client, customer, artist, slot(5, 13))).json()["message"] == "Pick one of the offered times"
    assert (await book(client, customer, artist, slot(5, 9))).status_code == 422
    assert (await book(client, customer, artist, slot(5, 12))).status_code == 201


async def test_a_closed_weekday_offers_no_slots(client, engine):
    _, artist, customer = await setup(client, engine)
    await save(client, artist, week(**{str(ist_day(5).weekday()): {"is_open": False}}))

    assert await free_hours(client, artist, 5) == []
    assert (await book(client, customer, artist, slot(5, 11))).status_code == 422
    assert await free_hours(client, artist, 6) == list(range(8, 18))


# --- days off -----------------------------------------------------------------------------------------------


async def test_a_day_off_closes_the_day_until_removed(client, engine):
    _, artist, customer = await setup(client, engine)
    url = f"{SCHEDULE}/days-off/{ist_day(5)}"

    added = await client.put(url, headers=artist["headers"])
    await client.put(url, headers=artist["headers"])
    again = await client.put(f"{SCHEDULE}/days-off/{ist_day(2)}", headers=artist["headers"])

    assert added.status_code == 200, added.text
    assert again.json()["days_off"] == [ist_day(2).isoformat(), ist_day(5).isoformat()]
    assert await free_hours(client, artist, 5) == []
    refused = await book(client, customer, artist, slot(5, 11))
    assert (refused.status_code, refused.json()["message"]) == (422, "Pick one of the offered times")

    removed = await client.delete(url, headers=artist["headers"])
    assert removed.status_code == 200
    assert removed.json()["days_off"] == [ist_day(2).isoformat()]
    assert (await client.delete(url, headers=artist["headers"])).status_code == 200
    assert await free_hours(client, artist, 5) == list(range(8, 18))
    assert (await book(client, customer, artist, slot(5, 11))).status_code == 201


async def test_days_off_stay_within_today_and_the_booking_horizon(client, engine):
    _, artist, _ = await setup(client, engine)
    for day in (ist_day(-1), ist_day(61)):
        response = await client.put(f"{SCHEDULE}/days-off/{day}", headers=artist["headers"])
        assert response.status_code == 422, day
    assert (await client.put(f"{SCHEDULE}/days-off/{ist_day(0)}", headers=artist["headers"])).status_code == 200
    assert (await client.put(f"{SCHEDULE}/days-off/{ist_day(60)}", headers=artist["headers"])).status_code == 200
    assert (await client.put(f"{SCHEDULE}/days-off/not-a-date", headers=artist["headers"])).status_code == 422


async def test_past_days_off_drop_out_of_the_schedule(client, engine, travel):
    _, artist, _ = await setup(client, engine)
    await client.put(f"{SCHEDULE}/days-off/{ist_day(1)}", headers=artist["headers"])
    await client.put(f"{SCHEDULE}/days-off/{ist_day(3)}", headers=artist["headers"])

    tomorrow_noon = datetime.combine(ist_day(2), datetime.min.time(), tzinfo=IST).replace(hour=12)
    travel(tomorrow_noon)

    assert (await client.get(SCHEDULE, headers=artist["headers"])).json()["days_off"] == [ist_day(3).isoformat()]


async def test_a_new_day_off_leaves_existing_bookings_alone(client, engine):
    _, artist, customer = await setup(client, engine)
    booking = (await book(client, customer, artist, slot(5, 11))).json()

    await client.put(f"{SCHEDULE}/days-off/{ist_day(5)}", headers=artist["headers"])

    mine = (await client.get(f"/api/v1/bookings/{booking['id']}", headers=customer)).json()
    assert mine["status"] == booking["status"] == "requested"
    assert datetime.fromisoformat(mine["start_at"]) == datetime.fromisoformat(slot(5, 11))
    accepted = await client.post(f"/api/v1/artists/me/bookings/{booking['id']}/accept", headers=artist["headers"])
    assert accepted.status_code == 200, accepted.text


# --- storefront ----------------------------------------------------------------------------------------------


async def test_storefront_shows_hours_and_travel_radius(client, engine):
    _, artist, _ = await setup(client, engine)
    public = (await client.get(f"/api/v1/artists/{artist['id']}")).json()
    assert (public["hours"], public["travel_radius_km"]) == (DEFAULT_WEEK, None)

    hours = week(**{"3": {"is_open": False}, "5": {"open_hour": 11, "close_hour": 21}})
    await save(client, artist, hours, radius=25)

    public = (await client.get(f"/api/v1/artists/{artist['id']}")).json()
    assert (public["hours"], public["travel_radius_km"]) == (hours, 25)
    assert "days_off" not in public


async def test_customers_still_see_the_artist_when_signed_in(client, engine):
    """The radius is display only: it never filters who a customer can find."""
    admin = await admin_headers(client, engine)
    artist = await approved_artist(client, engine, "+919845091001", admin)
    await save(client, artist, DEFAULT_WEEK, radius=1)
    customer = await sign_in(client, CUSTOMER_PHONE, role="customer")

    listed = (await client.get("/api/v1/artists", headers=customer)).json()["items"]
    assert [a["id"] for a in listed] == [artist["id"]]
