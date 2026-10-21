"""Enquiries & quotes: a customer asks an approved artist for a custom job (event date, what they need, a budget);
the artist quotes (price, duration, note, valid until) or declines, and may re-quote until it's accepted. The
customer accepts by picking a free start inside the artist's hours for the quoted duration, which books it
straight away as a confirmed booking at the quoted price. Quotes past their valid-until date, and enquiries
whose event date has passed, read as expired."""

from datetime import datetime, time

import pytest
import pytest_asyncio

from app.core.rate_limit import Limit
from app.quote.config import QuoteSettings, get_quote_settings
from app.quote.dependencies import enquiries_per_user
from tests.support.artist import approved_artist, complete_profile, submitted_artist_id
from tests.support.auth import sign_in
from tests.support.booking import book, setup
from tests.support.catalog import seed_categories
from tests.support.directory import IST, ist_day, slot

ENQUIRIES = "/api/v1/enquiries"
MINE = "/api/v1/artists/me/enquiries"
SCHEDULE = "/api/v1/artists/me/schedule"
INBOX = "/api/v1/notifications"
ADDRESS = "12 1st Block, Koramangala"


@pytest_asyncio.fixture(autouse=True)
async def categories_seeded(engine):
    await seed_categories(engine)


def same(a: str, b: str) -> bool:
    return datetime.fromisoformat(a) == datetime.fromisoformat(b)


def ist_noon(days: int) -> datetime:
    return datetime.combine(ist_day(days), time(12), tzinfo=IST)


async def enquire(client, customer: dict, artist: dict, **changes):
    body = {
        "artist_id": artist["id"],
        "event_date": str(ist_day(10)),
        "details": "  Bridal mehendi for me and two bridesmaids, both hands  ",
        "budget_paise": 800000,
        **changes,
    }
    return await client.post(ENQUIRIES, headers=customer, json=body)


async def quote(client, artist: dict, enquiry: dict, **changes):
    body = {"price_paise": 750000, "duration_minutes": 120, "note": "Includes travel", "valid_until": str(ist_day(7))}
    return await client.post(f"{MINE}/{enquiry['id']}/quote", headers=artist["headers"], json={**body, **changes})


async def quoted(client, customer: dict, artist: dict, **changes) -> dict:
    created = await enquire(client, customer, artist)
    assert created.status_code == 201, created.text
    answered = await quote(client, artist, created.json(), **changes)
    assert answered.status_code == 200, answered.text
    return answered.json()


async def accept(client, customer: dict, enquiry: dict, start: str, **changes):
    body = {"start_at": start, "address": ADDRESS, **changes}
    return await client.post(f"{ENQUIRIES}/{enquiry['id']}/accept", headers=customer, json=body)


async def free_hours(client, customer: dict, enquiry: dict, days: int) -> list[int]:
    response = await client.get(f"{ENQUIRIES}/{enquiry['id']}/availability?date={ist_day(days)}", headers=customer)
    assert response.status_code == 200, response.text
    return [
        datetime.fromisoformat(s["start_at"]).astimezone(IST).hour for s in response.json()["slots"] if s["available"]
    ]


async def inbox(client, headers) -> list[dict]:
    return (await client.get(INBOX, headers=headers)).json()["items"]


# --- the full flow ---------------------------------------------------------------------------------


async def test_enquiry_quote_accept_books_a_confirmed_booking_at_the_quoted_price(client, engine):
    _, artist, customer = await setup(client, engine)
    created = await enquire(client, customer, artist)
    assert created.status_code == 201, created.text
    e = created.json()
    assert e["status"] == "open"
    assert e["details"] == "Bridal mehendi for me and two bridesmaids, both hands"
    assert e["event_date"] == str(ist_day(10))
    assert e["budget_paise"] == 800000
    assert e["artist"]["id"] == artist["id"]
    assert e["artist"]["business_name"] == "Ayesha Mehendi Art"
    assert e["artist"]["city"] == "Bangalore"
    assert e["artist"]["photo_url"]
    assert set(e["customer"]) == {"first_name", "last_name"}
    assert (e["quote"], e["decline_reason"], e["booking_id"]) == (None, None, None)

    received = (await inbox(client, artist["headers"]))[0]
    assert (received["kind"], received["link"]) == ("enquiry_received", f"/artist/enquiries/{e['id']}")

    # Customers can't pick times before there's a quote.
    early = await client.get(f"{ENQUIRIES}/{e['id']}/availability?date={ist_day(5)}", headers=customer)
    assert early.status_code == 409

    answered = await quote(client, artist, e)
    assert answered.status_code == 200, answered.text
    q = answered.json()
    assert q["status"] == "quoted"
    assert q["quote"]["price_paise"] == 750000
    assert q["quote"]["duration_minutes"] == 120
    assert q["quote"]["note"] == "Includes travel"
    assert q["quote"]["valid_until"] == str(ist_day(7))
    assert q["quote"]["quoted_at"]
    told = (await inbox(client, customer))[0]
    assert (told["kind"], told["link"]) == ("quote_received", f"/customer/enquiries/{e['id']}")
    assert (await client.get(f"{ENQUIRIES}/{e['id']}", headers=customer)).json() == q

    # Two-hour slots within the default 08:00-20:00: the last start is 18:00 (a 3 h service stops at 17:00).
    assert await free_hours(client, customer, q, 5) == list(range(8, 19))

    booked = await accept(client, customer, q, slot(5, 18), note="  Gate code 42 ")
    assert booked.status_code == 201, booked.text
    body = booked.json()
    assert body["enquiry"]["status"] == "accepted"
    assert body["enquiry"]["booking_id"] == body["booking_id"]

    booking = (await client.get(f"/api/v1/bookings/{body['booking_id']}", headers=customer)).json()
    assert booking["status"] == "confirmed"
    assert booking["responded_at"]
    assert booking["service_id"] is None
    assert booking["service_name"] == "Custom quote"
    assert booking["duration_minutes"] == 120
    assert same(booking["start_at"], slot(5, 18))
    assert same(booking["end_at"], slot(5, 20))
    assert booking["address"] == ADDRESS
    assert booking["note"] == "Gate code 42"
    assert booking["subtotal_paise"] == 750000
    assert booking["artist"]["id"] == artist["id"]

    upcoming = (await client.get("/api/v1/bookings?scope=upcoming", headers=customer)).json()["items"]
    assert [b["id"] for b in upcoming] == [body["booking_id"]]
    theirs = (await client.get("/api/v1/artists/me/bookings?scope=upcoming", headers=artist["headers"])).json()
    assert [b["id"] for b in theirs["items"]] == [body["booking_id"]]
    assert theirs["items"][0]["commission_paise"] == 75000  # same commission as any booking

    notice = (await inbox(client, artist["headers"]))[0]
    assert (notice["kind"], notice["link"]) == ("quote_accepted", f"/artist/booking/{body['booking_id']}")

    # An accepted enquiry can't be accepted again.
    again = await accept(client, customer, q, slot(6, 11))
    assert again.status_code == 409
    assert again.json()["message"] == "This quote can't be accepted"


async def test_direct_mode_bookings_from_a_quote_carry_no_fee_or_deposit(client, engine, override):
    from app.booking.config import BookingSettings, get_booking_settings

    override(get_booking_settings, lambda: BookingSettings(payment_provider="direct"))
    _, artist, customer = await setup(client, engine)
    q = await quoted(client, customer, artist)
    booked = await accept(client, customer, q, slot(5, 11))
    assert booked.status_code == 201, booked.text
    b = (await client.get(f"/api/v1/bookings/{booked.json()['booking_id']}", headers=customer)).json()
    assert (b["subtotal_paise"], b["platform_fee_paise"], b["total_paise"], b["deposit_paise"]) == (
        750000,
        0,
        750000,
        0,
    )
    assert b["deposit_paid_at"] is None


async def test_availability_follows_the_artists_hours_days_off_and_bookings(client, engine):
    _, artist, customer = await setup(client, engine)
    hours = [{"weekday": d, "is_open": True, "open_hour": 10, "close_hour": 16} for d in range(7)]
    assert (await client.put(SCHEDULE, headers=artist["headers"], json={"hours": hours})).status_code == 200
    q = await quoted(client, customer, artist)
    assert await free_hours(client, customer, q, 5) == [10, 11, 12, 13, 14]

    # Someone else's booking 12:00-15:00 blocks every two-hour start that overlaps it.
    other = await sign_in(client, "+919845080002", role="customer")
    assert (await book(client, other, artist, slot(5, 12))).status_code == 201
    assert await free_hours(client, customer, q, 5) == [10]

    day_off = await client.put(f"{SCHEDULE}/days-off/{ist_day(6)}", headers=artist["headers"])
    assert day_off.status_code == 200, day_off.text
    shown = await client.get(f"{ENQUIRIES}/{q['id']}/availability?date={ist_day(6)}", headers=customer)
    assert shown.json() == {"date": str(ist_day(6)), "slots": []}

    beyond = await client.get(f"{ENQUIRIES}/{q['id']}/availability?date={ist_day(90)}", headers=customer)
    assert beyond.status_code == 422


async def test_accepting_needs_an_offered_and_free_time(client, engine):
    _, artist, customer = await setup(client, engine)
    q = await quoted(client, customer, artist)

    for start in (slot(5, 19), slot(5, 7), slot(5, 11).replace(":00:00", ":30:00"), slot(90, 11)):
        refused = await accept(client, customer, q, start)
        assert refused.status_code == 422, (start, refused.text)
        assert refused.json()["message"] == "Pick one of the offered times"

    other = await sign_in(client, "+919845080002", role="customer")
    assert (await book(client, other, artist, slot(5, 11))).status_code == 201
    taken = await accept(client, customer, q, slot(5, 12))
    assert taken.status_code == 409
    assert taken.json()["message"] == "That time was just taken. Pick another."
    assert (await client.get(f"{ENQUIRIES}/{q['id']}", headers=customer)).json()["status"] == "quoted"


async def test_accept_body_is_validated(client, engine):
    _, artist, customer = await setup(client, engine)
    q = await quoted(client, customer, artist)
    url = f"{ENQUIRIES}/{q['id']}/accept"
    for body in (
        {"start_at": slot(5, 11)},
        {"start_at": slot(5, 11), "address": "   "},
        {"start_at": slot(5, 11), "address": "x" * 301},
        {"start_at": slot(5, 11), "address": ADDRESS, "note": "x" * 501},
        {"start_at": "2026-12-01T11:00:00", "address": ADDRESS},  # no timezone
    ):
        assert (await client.post(url, headers=customer, json=body)).status_code == 422, body


# --- the artist's side -----------------------------------------------------------------------------


async def test_artist_can_requote_until_accepted(client, engine):
    _, artist, customer = await setup(client, engine)
    q = await quoted(client, customer, artist)
    revised = await quote(client, artist, q, price_paise=650000, duration_minutes=180, note=None)
    assert revised.status_code == 200, revised.text
    assert revised.json()["quote"]["price_paise"] == 650000
    assert revised.json()["quote"]["duration_minutes"] == 180
    assert revised.json()["quote"]["note"] is None
    assert [n["kind"] for n in await inbox(client, customer)] == ["quote_received", "quote_received"]
    assert await free_hours(client, customer, q, 5) == list(range(8, 18))

    booked = await accept(client, customer, q, slot(5, 11))
    assert booked.status_code == 201
    b = (await client.get(f"/api/v1/bookings/{booked.json()['booking_id']}", headers=customer)).json()
    assert (b["subtotal_paise"], b["duration_minutes"]) == (650000, 180)

    late = await quote(client, artist, q)
    assert late.status_code == 409


async def test_artist_declines_with_a_reason(client, engine):
    _, artist, customer = await setup(client, engine)
    e = (await enquire(client, customer, artist)).json()
    declined = await client.post(
        f"{MINE}/{e['id']}/decline", headers=artist["headers"], json={"reason": "  Booked out that week "}
    )
    assert declined.status_code == 200, declined.text
    assert declined.json()["status"] == "declined"
    assert declined.json()["decline_reason"] == "Booked out that week"
    told = (await inbox(client, customer))[0]
    assert (told["kind"], told["link"]) == ("enquiry_declined", f"/customer/enquiries/{e['id']}")

    assert (await client.post(f"{MINE}/{e['id']}/decline", headers=artist["headers"], json={})).status_code == 409
    assert (await quote(client, artist, e)).status_code == 409
    # A closed enquiry frees the customer to ask the same artist again.
    assert (await enquire(client, customer, artist)).status_code == 201


async def test_artist_lists_filters_and_counts_their_enquiries(client, engine):
    _, artist, customer = await setup(client, engine)
    first = (await enquire(client, customer, artist)).json()
    second_customer = await sign_in(client, "+919845080002", role="customer")
    second = await quoted(client, second_customer, artist)
    third_customer = await sign_in(client, "+919845080003", role="customer")
    third = (await enquire(client, third_customer, artist)).json()
    await client.post(f"{MINE}/{third['id']}/decline", headers=artist["headers"], json={})

    summary = await client.get(f"{MINE}/summary", headers=artist["headers"])
    assert summary.status_code == 200, summary.text
    assert summary.json() == {"open": 1, "quoted": 1}

    async def ids(query: str = "") -> list[str]:
        response = await client.get(f"{MINE}{query}", headers=artist["headers"])
        assert response.status_code == 200, response.text
        return [x["id"] for x in response.json()["items"]]

    assert await ids() == [third["id"], second["id"], first["id"]]
    assert await ids("?status=open") == [first["id"]]
    assert await ids("?status=quoted") == [second["id"]]
    assert await ids("?status=closed") == [third["id"]]
    assert (await client.get(f"{MINE}?status=nope", headers=artist["headers"])).status_code == 422

    page = (await client.get(f"{MINE}?limit=2", headers=artist["headers"])).json()
    assert [x["id"] for x in page["items"]] == [third["id"], second["id"]]
    rest = (await client.get(f"{MINE}?limit=2&cursor={page['next_cursor']}", headers=artist["headers"])).json()
    assert ([x["id"] for x in rest["items"]], rest["next_cursor"]) == ([first["id"]], None)

    one = await client.get(f"{MINE}/{first['id']}", headers=artist["headers"])
    assert one.status_code == 200
    assert one.json()["details"] == first["details"]


async def test_quote_is_validated(client, engine):
    _, artist, customer = await setup(client, engine)
    e = (await enquire(client, customer, artist)).json()
    for changes in (
        {"price_paise": 99},
        {"duration_minutes": 20},
        {"duration_minutes": 45},
        {"duration_minutes": 750},
        {"note": "x" * 501},
        {"valid_until": str(ist_day(-1))},
        {"valid_until": str(ist_day(11))},  # after the event
    ):
        assert (await quote(client, artist, e, **changes)).status_code == 422, changes
    assert (await quote(client, artist, e, valid_until=str(ist_day(10)))).status_code == 200


async def test_artists_only_see_their_own_enquiries(client, engine):
    admin, artist, customer = await setup(client, engine)
    e = (await enquire(client, customer, artist)).json()
    rival = await approved_artist(client, engine, "+919845091002", admin, name="Rival Studio")
    assert (await client.get(f"{MINE}/{e['id']}", headers=rival["headers"])).status_code == 404
    assert (await quote(client, rival, e)).status_code == 404
    assert (await client.post(f"{MINE}/{e['id']}/decline", headers=rival["headers"], json={})).status_code == 404
    assert (await client.get(MINE, headers=rival["headers"])).json()["items"] == []


async def test_an_unapproved_artist_cannot_work_enquiries(client, engine):
    pending = await sign_in(client, "+919845091003", role="artist")
    await complete_profile(client, pending)
    assert (await client.post("/api/v1/artists/me/submit", headers=pending)).status_code == 200
    assert (await client.get(MINE, headers=pending)).status_code == 409


# --- the customer's side ---------------------------------------------------------------------------


async def test_enquiry_is_validated(client, engine):
    _, artist, customer = await setup(client, engine)
    for changes in (
        {"details": "  too short  "},
        {"details": "x" * 1001},
        {"budget_paise": 99},
        {"event_date": str(ist_day(-1))},
        {"event_date": str(ist_day(61))},
        {"event_date": "21-10-2026"},
    ):
        assert (await enquire(client, customer, artist, **changes)).status_code == 422, changes
    assert (await enquire(client, customer, artist, budget_paise=None, event_date=str(ist_day(0)))).status_code == 201


async def test_enquiries_go_to_approved_artists_only(client, engine):
    _, _, customer = await setup(client, engine)
    pending = await submitted_artist_id(client, "+919845091003")
    for artist_id in (pending, "00000000-0000-0000-0000-000000000000"):
        missing = await enquire(client, customer, {"id": artist_id})
        assert missing.status_code == 404, missing.text


async def test_one_open_enquiry_per_artist(client, engine):
    _, artist, customer = await setup(client, engine)
    assert (await enquire(client, customer, artist)).status_code == 201
    dup = await enquire(client, customer, artist)
    assert dup.status_code == 409
    assert dup.json()["message"] == "You already have an open enquiry with this artist"
    # Still blocked once quoted.
    e = (await client.get(ENQUIRIES, headers=customer)).json()["items"][0]
    await quote(client, artist, e)
    assert (await enquire(client, customer, artist)).status_code == 409


async def test_open_enquiries_per_customer_are_capped(client, engine, override):
    override(get_quote_settings, lambda: QuoteSettings(max_open_enquiries_per_customer=1))
    admin, artist, customer = await setup(client, engine)
    other = await approved_artist(client, engine, "+919845091002", admin, name="Second Studio")
    assert (await enquire(client, customer, artist)).status_code == 201
    capped = await enquire(client, customer, other)
    assert capped.status_code == 409
    assert "open enquiries" in capped.json()["message"]


def test_the_default_cap_is_five():
    assert QuoteSettings().max_open_enquiries_per_customer == 5


async def test_enquiries_are_rate_limited(client, engine, override):
    override(enquiries_per_user, lambda: Limit(hits=1, window_seconds=3600))
    _, artist, customer = await setup(client, engine)
    assert (await enquire(client, customer, artist)).status_code == 201
    limited = await enquire(client, customer, artist)
    assert (limited.status_code, limited.json()["code"]) == (429, "rate_limited")


async def test_customer_lists_newest_first_and_cancels(client, engine):
    admin, artist, customer = await setup(client, engine)
    other = await approved_artist(client, engine, "+919845091002", admin, name="Second Studio")
    first = (await enquire(client, customer, artist)).json()
    second = (await enquire(client, customer, other)).json()

    listed = (await client.get(ENQUIRIES, headers=customer)).json()
    assert [x["id"] for x in listed["items"]] == [second["id"], first["id"]]
    assert listed["next_cursor"] is None
    page = (await client.get(f"{ENQUIRIES}?limit=1", headers=customer)).json()
    assert [x["id"] for x in page["items"]] == [second["id"]]
    rest = (await client.get(f"{ENQUIRIES}?limit=1&cursor={page['next_cursor']}", headers=customer)).json()
    assert [x["id"] for x in rest["items"]] == [first["id"]]

    cancelled = await client.post(f"{ENQUIRIES}/{first['id']}/cancel", headers=customer)
    assert cancelled.status_code == 200, cancelled.text
    assert cancelled.json()["status"] == "cancelled"
    assert (await client.post(f"{ENQUIRIES}/{first['id']}/cancel", headers=customer)).status_code == 409
    assert (await quote(client, artist, first)).status_code == 409

    q = await quoted(client, customer, artist)
    assert (await client.post(f"{ENQUIRIES}/{q['id']}/cancel", headers=customer)).json()["status"] == "cancelled"
    assert (await accept(client, customer, q, slot(5, 11))).status_code == 409


async def test_other_customers_get_404(client, engine):
    _, artist, customer = await setup(client, engine)
    q = await quoted(client, customer, artist)
    stranger = await sign_in(client, "+919845080009", role="customer")
    assert (await client.get(f"{ENQUIRIES}/{q['id']}", headers=stranger)).status_code == 404
    assert (await client.post(f"{ENQUIRIES}/{q['id']}/cancel", headers=stranger)).status_code == 404
    url = f"{ENQUIRIES}/{q['id']}/availability?date={ist_day(5)}"
    assert (await client.get(url, headers=stranger)).status_code == 404
    assert (await accept(client, stranger, q, slot(5, 11))).status_code == 404
    assert (await client.get(ENQUIRIES, headers=stranger)).json()["items"] == []


async def test_artists_cannot_enquire_with_themselves(client, engine):
    _, artist, _ = await setup(client, engine)
    await client.put("/api/v1/users/me/role", headers=artist["headers"], json={"role": "customer"})
    own = await enquire(client, artist["headers"], artist)
    assert own.status_code == 422


# --- expiry ----------------------------------------------------------------------------------------


async def test_a_quote_expires_after_its_valid_until_date(client, engine, travel):
    _, artist, customer = await setup(client, engine)
    q = await quoted(client, customer, artist, valid_until=str(ist_day(3)))

    travel(ist_noon(3))  # still valid on the day itself
    assert (await client.get(f"{ENQUIRIES}/{q['id']}", headers=customer)).json()["status"] == "quoted"

    travel(ist_noon(4))
    assert (await client.get(f"{ENQUIRIES}/{q['id']}", headers=customer)).json()["status"] == "expired"
    late = await accept(client, customer, q, slot(6, 11))
    assert late.status_code == 409
    assert late.json()["message"] == "This quote can't be accepted"
    assert (
        await client.get(f"{ENQUIRIES}/{q['id']}/availability?date={ist_day(6)}", headers=customer)
    ).status_code == 409
    assert (await client.get(f"{MINE}/summary", headers=artist["headers"])).json() == {"open": 0, "quoted": 0}
    closed = (await client.get(f"{MINE}?status=closed", headers=artist["headers"])).json()["items"]
    assert [x["id"] for x in closed] == [q["id"]]
    # An expired enquiry no longer blocks a new one.
    assert (await enquire(client, customer, artist)).status_code == 201


async def test_an_unanswered_enquiry_expires_after_its_event_date(client, engine, travel):
    _, artist, customer = await setup(client, engine)
    e = (await enquire(client, customer, artist, event_date=str(ist_day(2)))).json()
    travel(ist_noon(2))
    assert (await client.get(f"{MINE}/{e['id']}", headers=artist["headers"])).json()["status"] == "open"
    travel(ist_noon(3))
    assert (await client.get(f"{MINE}/{e['id']}", headers=artist["headers"])).json()["status"] == "expired"
    assert (await quote(client, artist, e, valid_until=str(ist_day(3)))).status_code == 409


# --- account deletion ------------------------------------------------------------------------------


async def test_deleting_a_customer_account_cancels_their_open_enquiries(client, engine):
    _, artist, customer = await setup(client, engine)
    e = (await enquire(client, customer, artist)).json()
    assert (await client.delete("/api/v1/users/me", headers=customer)).status_code == 204
    seen = (await client.get(f"{MINE}/{e['id']}", headers=artist["headers"])).json()
    assert seen["status"] == "cancelled"
    assert (await client.get(f"{MINE}/summary", headers=artist["headers"])).json() == {"open": 0, "quoted": 0}


async def test_deleting_an_artist_account_cancels_their_open_enquiries(client, engine):
    _, artist, customer = await setup(client, engine)
    q = await quoted(client, customer, artist)
    before = len(await inbox(client, customer))
    assert (await client.delete("/api/v1/users/me", headers=artist["headers"])).status_code == 204
    assert (await client.get(f"{ENQUIRIES}/{q['id']}", headers=customer)).json()["status"] == "cancelled"
    assert len(await inbox(client, customer)) == before  # no notification


@pytest.mark.parametrize("path", [ENQUIRIES, MINE])
async def test_enquiries_need_a_signed_in_user(client, path):
    assert (await client.get(path)).status_code == 401
