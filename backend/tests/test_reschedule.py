"""Rescheduling: the customer asks to move a confirmed booking that hasn't started; the booking keeps its time
until the artist accepts (it moves) or declines (it stays). One pending request per booking, and the asked-for
time is held for the artist while it waits, so nobody else can book it."""

from datetime import datetime, timedelta

import pytest_asyncio

from tests.support.artist import approved_artist
from tests.support.auth import sign_in
from tests.support.booking import at, book, setup
from tests.support.catalog import seed_categories
from tests.support.directory import IST, ist_day, slot

SCHEDULE = "/api/v1/artists/me/schedule"


@pytest_asyncio.fixture(autouse=True)
async def categories_seeded(engine):
    await seed_categories(engine)


def same(a: str, b: str) -> bool:
    return datetime.fromisoformat(a) == datetime.fromisoformat(b)


async def confirmed(client, customer: dict, artist: dict, start: str | None = None) -> dict:
    b = (await book(client, customer, artist, start or slot(5, 11))).json()
    accepted = await client.post(f"/api/v1/artists/me/bookings/{b['id']}/accept", headers=artist["headers"])
    assert accepted.status_code == 200, accepted.text
    return accepted.json()


def ask(client, customer: dict, booking: dict, start: str):
    return client.post(f"/api/v1/bookings/{booking['id']}/reschedule", headers=customer, json={"start_at": start})


def answer(client, artist: dict, booking: dict, verb: str, **body):
    url = f"/api/v1/artists/me/bookings/{booking['id']}/reschedule/{verb}"
    return client.post(url, headers=artist["headers"], **({"json": body} if verb == "decline" else {}))


async def free_hours(client, artist: dict, days: int) -> list[int]:
    url = f"/api/v1/artists/{artist['id']}/availability?date={ist_day(days)}&service_id={artist['service_id']}"
    slots = (await client.get(url)).json()["slots"]
    return [datetime.fromisoformat(s["start_at"]).astimezone(IST).hour for s in slots if s["available"]]


async def inbox(client, headers) -> list[dict]:
    return (await client.get("/api/v1/notifications", headers=headers)).json()["items"]


# --- happy paths ----------------------------------------------------------------------------------


async def test_customer_asks_and_the_artist_accepts_the_move(client, engine):
    admin, artist, customer = await setup(client, engine)
    b = await confirmed(client, customer, artist)
    assert b["reschedule"] is None
    assert b["reschedule_declined_reason"] is None
    assert b["service_id"] == artist["service_id"]

    asked = await ask(client, customer, b, slot(6, 11))
    assert asked.status_code == 200, asked.text
    shown = asked.json()
    assert same(shown["start_at"], b["start_at"])  # keeps its time until the artist accepts
    pending = shown["reschedule"]
    assert same(pending["start_at"], slot(6, 11))
    assert same(pending["end_at"], slot(6, 14))
    window = datetime.fromisoformat(pending["expires_at"]) - datetime.fromisoformat(pending["requested_at"])
    assert window == timedelta(hours=3)

    notice = (await inbox(client, artist["headers"]))[0]
    assert notice["kind"] == "reschedule_requested"
    assert notice["title"] == "Asked to move a booking"
    assert notice["body"].startswith("Bridal Classic from ")
    assert notice["link"] == f"/artist/booking/{b['id']}"

    # Artist, admin views carry it too; upcoming still lists the booking at its current time.
    artist_view = (await client.get(f"/api/v1/artists/me/bookings/{b['id']}", headers=artist["headers"])).json()
    assert same(artist_view["reschedule"]["start_at"], slot(6, 11))
    admin_view = (await client.get(f"/api/v1/admin/bookings/{b['id']}", headers=admin)).json()
    assert same(admin_view["reschedule"]["start_at"], slot(6, 11))
    upcoming = (await client.get("/api/v1/artists/me/bookings?scope=upcoming", headers=artist["headers"])).json()
    assert [(x["id"], x["start_at"]) for x in upcoming["items"]] == [(b["id"], b["start_at"])]
    assert (await client.get("/api/v1/artists/me/dashboard", headers=artist["headers"])).json()["upcoming"] == 1

    # Both the current and the asked-for range are held.
    assert 11 not in await free_hours(client, artist, 5)
    assert 11 not in await free_hours(client, artist, 6)

    moved = await answer(client, artist, b, "accept")
    assert moved.status_code == 200, moved.text
    after = moved.json()
    assert same(after["start_at"], slot(6, 11))
    assert same(after["end_at"], slot(6, 14))
    assert after["reschedule"] is None
    assert after["status"] == "confirmed"

    told = (await inbox(client, customer))[0]
    assert told["kind"] == "reschedule_accepted"
    assert told["link"] == f"/customer/booking/{b['id']}"
    assert 11 in await free_hours(client, artist, 5)  # the old slot is free again
    assert 11 not in await free_hours(client, artist, 6)


async def test_artist_declines_and_the_booking_keeps_its_time(client, engine):
    _, artist, customer = await setup(client, engine)
    b = await confirmed(client, customer, artist)
    await ask(client, customer, b, slot(6, 11))

    declined = await answer(client, artist, b, "decline", reason="  Booked out that day ")
    assert declined.status_code == 200, declined.text
    assert declined.json()["reschedule"] is None
    assert same(declined.json()["start_at"], b["start_at"])

    mine = (await client.get(f"/api/v1/bookings/{b['id']}", headers=customer)).json()
    assert mine["reschedule_declined_reason"] == "Booked out that day"
    assert (await inbox(client, customer))[0]["kind"] == "reschedule_declined"
    assert 11 in await free_hours(client, artist, 6)

    # A new request clears the last decline's reason.
    again = (await ask(client, customer, b, slot(7, 11))).json()
    assert again["reschedule_declined_reason"] is None
    assert again["reschedule"] is not None


async def test_customer_withdraws_a_request(client, engine):
    _, artist, customer = await setup(client, engine)
    b = await confirmed(client, customer, artist)
    await ask(client, customer, b, slot(6, 11))

    url = f"/api/v1/bookings/{b['id']}/reschedule"
    withdrawn = await client.delete(url, headers=customer)
    assert withdrawn.status_code == 200
    assert withdrawn.json()["reschedule"] is None
    assert (await client.delete(url, headers=customer)).status_code == 200  # idempotent
    assert 11 in await free_hours(client, artist, 6)

    for verb in ("accept", "decline"):
        late = await answer(client, artist, b, verb)
        assert late.status_code == 409
        assert late.json()["message"] == "No change was asked for"


# --- which bookings can move --------------------------------------------------------------------------


async def test_only_confirmed_bookings_that_have_not_started_can_move(client, engine, travel):
    _, artist, customer = await setup(client, engine)
    unconfirmed = (await book(client, customer, artist, slot(5, 11))).json()
    response = await ask(client, customer, unconfirmed, slot(6, 11))
    assert response.status_code == 409
    assert response.json()["message"] == "This booking can't be moved"

    cancelled = await confirmed(client, customer, artist, slot(8, 11))
    await client.post(f"/api/v1/bookings/{cancelled['id']}/cancel", headers=customer, json={})
    assert (await ask(client, customer, cancelled, slot(9, 11))).status_code == 409

    started = await confirmed(client, customer, artist, slot(10, 11))
    travel(at(started["start_at"], 0.5))
    response = await ask(client, customer, started, slot(12, 11))
    assert response.status_code == 409
    assert response.json()["message"] == "This booking can't be moved"


async def test_one_pending_request_per_booking(client, engine):
    _, artist, customer = await setup(client, engine)
    b = await confirmed(client, customer, artist)
    assert (await ask(client, customer, b, slot(6, 11))).status_code == 200
    second = await ask(client, customer, b, slot(7, 11))
    assert second.status_code == 409
    assert second.json()["message"] == "You've already asked to move this booking"


async def test_the_new_time_must_be_one_a_new_booking_could_take(client, engine, travel):
    _, artist, customer = await setup(client, engine)
    b = await confirmed(client, customer, artist, slot(8, 11))

    for start in (slot(6, 7), slot(6, 18), slot(70, 11), slot(-1, 11)):  # before opening, past closing, out of range
        response = await ask(client, customer, b, start)
        assert response.status_code == 422, start
        assert response.json()["message"] == "Pick one of the offered times"

    await client.put(f"{SCHEDULE}/days-off/{ist_day(6)}", headers=artist["headers"])
    day_off = await ask(client, customer, b, slot(6, 11))
    assert day_off.status_code == 422

    travel(at(slot(7, 10), -1))  # 09:00 IST that day: 10:00 is inside the lead time
    too_soon = await ask(client, customer, b, slot(7, 10))
    assert too_soon.status_code == 422
    assert too_soon.json()["message"] == "Pick one of the offered times"

    same_time = await ask(client, customer, b, b["start_at"])
    assert same_time.status_code == 422

    naive = await ask(client, customer, b, datetime.fromisoformat(slot(9, 11)).replace(tzinfo=None).isoformat())
    assert naive.status_code == 422


async def test_the_new_time_cannot_overlap_another_booking(client, engine):
    _, artist, customer = await setup(client, engine)
    b = await confirmed(client, customer, artist)
    other = await sign_in(client, "+919845080002", role="customer")
    assert (await book(client, other, artist, slot(6, 11))).status_code == 201

    clash = await ask(client, customer, b, slot(6, 12))
    assert clash.status_code == 409
    assert clash.json()["message"] == "That time was just taken. Pick another."

    # Moving within its own current range is fine: the booking doesn't clash with itself.
    assert (await ask(client, customer, b, slot(5, 12))).status_code == 200


async def test_a_pending_time_blocks_other_customers(client, engine):
    _, artist, customer = await setup(client, engine)
    b = await confirmed(client, customer, artist)
    await ask(client, customer, b, slot(6, 11))
    other = await sign_in(client, "+919845080002", role="customer")
    taken = await book(client, other, artist, slot(6, 12))
    assert taken.status_code == 409


async def test_an_unanswered_request_expires(client, engine, travel):
    _, artist, customer = await setup(client, engine)
    b = await confirmed(client, customer, artist)
    pending = (await ask(client, customer, b, slot(6, 11))).json()["reschedule"]

    travel(at(pending["expires_at"], 0.01))
    assert 11 in await free_hours(client, artist, 6)
    shown = (await client.get(f"/api/v1/bookings/{b['id']}", headers=customer)).json()
    assert shown["reschedule"] is None
    assert same(shown["start_at"], b["start_at"])
    late = await answer(client, artist, b, "accept")
    assert late.status_code == 409
    assert late.json()["message"] == "No change was asked for"
    # The customer may ask again once it has lapsed.
    assert (await ask(client, customer, b, slot(7, 11))).status_code == 200


async def test_a_request_close_to_the_booking_expires_by_its_start(client, engine, travel):
    _, artist, customer = await setup(client, engine)
    b = await confirmed(client, customer, artist)
    travel(at(b["start_at"], -2.5))  # 30 min before the 3 h answer window would pass the current start
    pending = (await ask(client, customer, b, slot(6, 11))).json()["reschedule"]
    assert same(pending["expires_at"], b["start_at"])


async def test_others_cannot_touch_a_reschedule(client, engine):
    admin, artist, customer = await setup(client, engine)
    b = await confirmed(client, customer, artist)
    stranger = await sign_in(client, "+919845080003", role="customer")
    assert (await ask(client, stranger, b, slot(6, 11))).status_code == 404
    assert (await client.delete(f"/api/v1/bookings/{b['id']}/reschedule", headers=stranger)).status_code == 404

    await ask(client, customer, b, slot(6, 11))
    noor = await approved_artist(client, engine, "+919845091002", admin, name="Henna by Noor")
    assert (await answer(client, noor, b, "accept")).status_code == 404
    assert (await answer(client, noor, b, "decline")).status_code == 404


async def test_cancelling_drops_a_pending_request(client, engine):
    _, artist, customer = await setup(client, engine)
    b = await confirmed(client, customer, artist)
    await ask(client, customer, b, slot(6, 11))
    cancelled = (await client.post(f"/api/v1/bookings/{b['id']}/cancel", headers=customer, json={})).json()
    assert cancelled["reschedule"] is None
    assert 11 in await free_hours(client, artist, 6)
