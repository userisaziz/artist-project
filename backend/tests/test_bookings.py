"""Booking contract: a customer requests a slot with a deposit; the artist accepts, declines or completes;
customers and admins cancel. Time is moved with the `travel` fixture (a get_clock override)."""

import asyncio
import re
from datetime import datetime, timedelta

import pytest
import pytest_asyncio
from sqlalchemy import text

from app.booking.config import BookingSettings, get_booking_settings
from tests.support.artist import approved_artist
from tests.support.auth import CUSTOMER_PHONE, sign_in
from tests.support.booking import at, book, setup
from tests.support.catalog import seed_categories
from tests.support.directory import slot


@pytest_asyncio.fixture(autouse=True)
async def categories_seeded(engine):
    await seed_categories(engine)


# --- create ---------------------------------------------------------------------------------------


async def test_customer_requests_a_booking_and_pays_the_deposit(client, engine):
    _, artist, customer = await setup(client, engine)
    response = await book(client, customer, artist, note="Keep palms lighter")
    assert response.status_code == 201
    b = response.json()
    assert re.fullmatch(r"BK-[A-Z2-9]{6}", b["code"])
    assert b["status"] == "requested"
    assert b["service_name"] == "Bridal Classic"
    assert b["duration_minutes"] == 180
    assert datetime.fromisoformat(b["end_at"]) - datetime.fromisoformat(b["start_at"]) == timedelta(hours=3)
    # ₹5,500 + ₹99 fee = ₹5,599; the 30% deposit rounds to ₹1,680. The platform margin stays hidden from customers.
    assert {
        k: b[k]
        for k in (
            "subtotal_paise",
            "platform_fee_paise",
            "total_paise",
            "deposit_paise",
            "balance_paise",
            "commission_paise",
            "artist_earning_paise",
        )
    } == {
        "subtotal_paise": 550000,
        "platform_fee_paise": 9900,
        "total_paise": 559900,
        "deposit_paise": 168000,
        "balance_paise": 391900,
        "commission_paise": None,
        "artist_earning_paise": None,
    }
    assert b["deposit_paid_at"] is not None
    assert datetime.fromisoformat(b["expires_at"]) - datetime.fromisoformat(b["deposit_paid_at"]) == timedelta(hours=3)
    assert b["artist"]["business_name"] == "Ayesha Mehendi Art"
    assert b["artist"]["city"] == "Bangalore"
    assert b["note"] == "Keep palms lighter"
    assert b["refund_due"] is None

    upcoming = (await client.get("/api/v1/bookings?scope=upcoming", headers=customer)).json()
    assert [x["id"] for x in upcoming["items"]] == [b["id"]]
    assert (await client.get("/api/v1/bookings?scope=past", headers=customer)).json()["items"] == []
    assert (await client.get(f"/api/v1/bookings/{b['id']}", headers=customer)).json()["code"] == b["code"]


async def test_platform_fee_is_waived_from_25000(client, engine):
    _, artist, customer = await setup(client, engine)
    async with engine.begin() as conn:
        await conn.execute(
            text("UPDATE artist_service_item SET price_paise=2500000 WHERE id=:i"), {"i": artist["service_id"]}
        )
    b = (await book(client, customer, artist)).json()
    assert (b["platform_fee_paise"], b["total_paise"], b["deposit_paise"]) == (0, 2500000, 750000)


async def test_a_taken_slot_conflicts_until_the_request_is_declined(client, engine):
    _, artist, customer = await setup(client, engine)
    first = (await book(client, customer, artist, slot(5, 11))).json()
    overlapping = await book(client, customer, artist, slot(5, 13))
    assert overlapping.status_code == 409
    assert overlapping.json()["message"] == "That time was just taken. Pick another slot."

    declined = await client.post(
        f"/api/v1/artists/me/bookings/{first['id']}/decline",
        headers=artist["headers"],
        json={"reason": "Travelling that day"},
    )
    assert declined.json()["status"] == "declined"
    assert declined.json()["decline_reason"] == "Travelling that day"
    assert declined.json()["refund_due"] is True
    assert (await book(client, customer, artist, slot(5, 13))).status_code == 201


async def _racing(engine, lock_sql: str, params: dict, *requests):
    """Hold a row lock in another transaction while `requests` start, so they all reach the lock and wait;
    then release it. Only the app's own row locks can then stop them from both passing their checks."""
    async with engine.connect() as holder:
        await holder.begin()
        await holder.execute(text(lock_sql), params)
        tasks = [asyncio.ensure_future(r) for r in requests]
        await asyncio.sleep(0.3)
        assert not any(t.done() for t in tasks), "requests should be queued behind the held lock"
        await holder.commit()
        return await asyncio.gather(*tasks)


async def test_only_one_of_two_simultaneous_requests_gets_the_slot(client, engine):
    _, artist, customer = await setup(client, engine)
    other = await sign_in(client, "+919845080002", role="customer")
    results = await _racing(
        engine,
        "SELECT id FROM artist_profile WHERE id = :id FOR UPDATE",
        {"id": artist["id"]},
        book(client, customer, artist),
        book(client, other, artist),
    )
    assert sorted(r.status_code for r in results) == [201, 409]


async def test_one_customer_racing_two_artists_cannot_pass_the_open_request_cap(client, engine, override):
    override(
        get_booking_settings,
        lambda: BookingSettings(environment="test", payment_provider="mock", max_open_requests_per_customer=1),
    )
    admin, artist, customer = await setup(client, engine)
    noor = await approved_artist(client, engine, "+919845091002", admin, name="Henna by Noor")
    results = await _racing(
        engine,
        "SELECT id FROM user_account WHERE phone = :phone FOR UPDATE",
        {"phone": CUSTOMER_PHONE},
        book(client, customer, artist),
        book(client, customer, noor),
    )
    assert sorted(r.status_code for r in results) == [201, 409]
    assert "requests waiting" in next(r for r in results if r.status_code == 409).json()["message"]


async def test_start_must_be_a_bookable_hourly_slot(client, engine):
    _, artist, customer = await setup(client, engine)
    assert (await book(client, customer, artist, slot(5, 8))).status_code == 422  # before 9 AM
    assert (await book(client, customer, artist, slot(5, 18))).status_code == 422  # after the last start
    off_hour = datetime.fromisoformat(slot(5, 11)) + timedelta(minutes=30)
    assert (await book(client, customer, artist, off_hour.isoformat())).status_code == 422
    assert (await book(client, customer, artist, slot(-1, 11))).status_code == 422
    assert (await book(client, customer, artist, slot(70, 11))).status_code == 422
    assert (await book(client, customer, artist, address=" ")).status_code == 422


async def test_cannot_book_an_unbookable_service(client, engine):
    admin, artist, customer = await setup(client, engine)
    noor = await approved_artist(client, engine, "+919845091002", admin, name="Henna by Noor")
    assert (await book(client, customer, {"id": artist["id"], "service_id": noor["service_id"]})).status_code == 404

    async with engine.begin() as conn:
        await conn.execute(
            text("UPDATE artist_service_item SET status='pending' WHERE id=:i"), {"i": artist["service_id"]}
        )
    assert (await book(client, customer, artist)).status_code == 404

    async with engine.begin() as conn:
        await conn.execute(text("UPDATE artist_profile SET status='rejected' WHERE id=:i"), {"i": noor["id"]})
    assert (await book(client, customer, noor)).status_code == 404


async def test_artists_cannot_book_themselves(client, engine):
    _, artist, _ = await setup(client, engine)
    await client.put("/api/v1/users/me/role", headers=artist["headers"], json={"role": "customer"})
    response = await book(client, artist["headers"], artist)
    assert response.status_code == 422
    assert response.json()["message"] == "You can't book your own services"


async def test_bookings_need_a_customer_account(client, engine):
    _, artist, _ = await setup(client, engine)
    other_artist = await sign_in(client, "+919845091003", role="artist")
    assert (await book(client, other_artist, artist)).status_code == 403
    assert (await client.get("/api/v1/bookings")).status_code in (401, 403)


# --- artist side ----------------------------------------------------------------------------------


async def test_artist_accepts_then_completes_after_the_start(client, engine, travel):
    _, artist, customer = await setup(client, engine)
    b = (await book(client, customer, artist)).json()
    h = artist["headers"]

    requests = (await client.get("/api/v1/artists/me/bookings?scope=requests", headers=h)).json()["items"]
    assert [r["id"] for r in requests] == [b["id"]]
    assert (await client.get("/api/v1/artists/me/dashboard", headers=h)).json()["requests"] == 1

    accepted = await client.post(f"/api/v1/artists/me/bookings/{b['id']}/accept", headers=h)
    assert accepted.json()["status"] == "confirmed"
    assert (await client.post(f"/api/v1/artists/me/bookings/{b['id']}/accept", headers=h)).status_code == 409
    upcoming = (await client.get("/api/v1/artists/me/bookings?scope=upcoming", headers=h)).json()["items"]
    assert [r["id"] for r in upcoming] == [b["id"]]

    assert (await client.post(f"/api/v1/artists/me/bookings/{b['id']}/complete", headers=h)).status_code == 409
    travel(at(b["start_at"], 4))
    done = await client.post(f"/api/v1/artists/me/bookings/{b['id']}/complete", headers=h)
    assert done.json()["status"] == "completed"

    dashboard = (await client.get("/api/v1/artists/me/dashboard", headers=h)).json()
    assert dashboard["completed_this_month"] == 1
    assert dashboard["earnings_this_month_paise"] == 495000
    past = (await client.get("/api/v1/bookings?scope=past", headers=customer)).json()["items"]
    assert [x["status"] for x in past] == ["completed"]
    assert (await client.get(f"/api/v1/artists/{artist['id']}")).json()["completed_bookings"] == 1


async def test_dashboard_lists_todays_schedule(client, engine, travel):
    _, artist, customer = await setup(client, engine)
    b = (await book(client, customer, artist, slot(5, 14))).json()
    await client.post(f"/api/v1/artists/me/bookings/{b['id']}/accept", headers=artist["headers"])
    travel(at(b["start_at"], -5))  # 9 AM IST that day
    today = (await client.get("/api/v1/artists/me/dashboard", headers=artist["headers"])).json()["today"]
    assert [x["id"] for x in today] == [b["id"]]


async def test_unanswered_requests_expire(client, engine, travel):
    _, artist, customer = await setup(client, engine)
    b = (await book(client, customer, artist)).json()
    travel(at(b["expires_at"], 0.01))

    shown = (await client.get(f"/api/v1/bookings/{b['id']}", headers=customer)).json()
    assert (shown["status"], shown["refund_due"]) == ("expired", True)
    late = await client.post(f"/api/v1/artists/me/bookings/{b['id']}/accept", headers=artist["headers"])
    assert late.status_code == 409
    assert late.json()["message"] == "This booking is already expired"


async def test_calendar_range_lists_every_status(client, engine):
    _, artist, customer = await setup(client, engine)
    a = (await book(client, customer, artist, slot(5, 9))).json()
    b = (await book(client, customer, artist, slot(6, 9))).json()
    await client.post(f"/api/v1/artists/me/bookings/{a['id']}/accept", headers=artist["headers"])
    day = datetime.fromisoformat(slot(5, 9)).date()
    url = f"/api/v1/artists/me/bookings?from={day}&to={day + timedelta(days=1)}&limit=200"
    items = (await client.get(url, headers=artist["headers"])).json()["items"]
    assert [(x["id"], x["status"]) for x in items] == [(a["id"], "confirmed"), (b["id"], "requested")]
    one_day = (await client.get(f"/api/v1/artists/me/bookings?from={day}&to={day}", headers=artist["headers"])).json()
    assert [x["id"] for x in one_day["items"]] == [a["id"]]


async def test_artist_bookings_need_an_approved_profile(client, engine):
    headers = await sign_in(client, "+919845091004")
    assert (await client.get("/api/v1/artists/me/bookings", headers=headers)).status_code == 404  # no profile yet
    category = (await client.get("/api/v1/categories")).json()[0]["id"]
    await client.put(
        "/api/v1/artists/me/profile",
        headers=headers,
        json={
            "business_name": "Draft",
            "city": "Pune",
            "category_ids": [category],
        },
    )
    assert (await client.get("/api/v1/artists/me/bookings", headers=headers)).status_code == 409


# --- cancelling and ownership ---------------------------------------------------------------------


async def test_customer_cancellation_refunds_only_well_ahead(client, engine, travel):
    _, artist, customer = await setup(client, engine)
    early = (await book(client, customer, artist, slot(10, 11))).json()
    r = (
        await client.post(f"/api/v1/bookings/{early['id']}/cancel", headers=customer, json={"reason": "Date moved"})
    ).json()
    assert (r["status"], r["refund_due"], r["cancelled_by"], r["cancel_reason"]) == (
        "cancelled",
        True,
        "customer",
        "Date moved",
    )

    late = (await book(client, customer, artist, slot(10, 15))).json()
    await client.post(f"/api/v1/artists/me/bookings/{late['id']}/accept", headers=artist["headers"])
    travel(at(late["start_at"], -24))  # a day before: inside the 72 h window
    r = (await client.post(f"/api/v1/bookings/{late['id']}/cancel", headers=customer, json={})).json()
    assert (r["status"], r["refund_due"]) == ("cancelled", False)

    travel.back()
    gone = (await book(client, customer, artist, slot(12, 11))).json()
    await client.post(f"/api/v1/artists/me/bookings/{gone['id']}/accept", headers=artist["headers"])
    travel(at(gone["start_at"], 1))
    assert (await client.post(f"/api/v1/bookings/{gone['id']}/cancel", headers=customer, json={})).status_code == 409


async def test_others_cannot_see_or_change_a_booking(client, engine):
    admin, artist, customer = await setup(client, engine)
    b = (await book(client, customer, artist)).json()
    stranger = await sign_in(client, "+919845080003", role="customer")
    assert (await client.get(f"/api/v1/bookings/{b['id']}", headers=stranger)).status_code == 404
    assert (await client.post(f"/api/v1/bookings/{b['id']}/cancel", headers=stranger, json={})).status_code == 404
    noor = await approved_artist(client, engine, "+919845091002", admin, name="Henna by Noor")
    assert (
        await client.post(f"/api/v1/artists/me/bookings/{b['id']}/accept", headers=noor["headers"])
    ).status_code == 404


# --- admin ----------------------------------------------------------------------------------------


async def test_admin_lists_filters_and_cancels(client, engine):
    admin, artist, customer = await setup(client, engine)
    a = (await book(client, customer, artist, slot(5, 9))).json()
    b = (await book(client, customer, artist, slot(6, 9))).json()
    await client.post(f"/api/v1/artists/me/bookings/{b['id']}/accept", headers=artist["headers"])

    everything = (await client.get("/api/v1/admin/bookings", headers=admin)).json()
    assert [x["id"] for x in everything["items"]] == [b["id"], a["id"]]  # newest first
    assert everything["items"][0]["customer"]["phone"] == CUSTOMER_PHONE
    confirmed = (await client.get("/api/v1/admin/bookings?status=confirmed", headers=admin)).json()["items"]
    assert [x["id"] for x in confirmed] == [b["id"]]
    by_code = (await client.get(f"/api/v1/admin/bookings?q={a['code'].lower()}", headers=admin)).json()["items"]
    assert [x["id"] for x in by_code] == [a["id"]]
    assert len((await client.get("/api/v1/admin/bookings?q=ayesha", headers=admin)).json()["items"]) == 2
    page = (await client.get("/api/v1/admin/bookings?limit=1", headers=admin)).json()
    rest = (await client.get(f"/api/v1/admin/bookings?limit=1&cursor={page['next_cursor']}", headers=admin)).json()
    assert [x["id"] for x in page["items"] + rest["items"]] == [b["id"], a["id"]]

    assert (
        await client.post(f"/api/v1/admin/bookings/{b['id']}/cancel", headers=admin, json={"reason": ""})
    ).status_code == 422
    cancelled = (
        await client.post(f"/api/v1/admin/bookings/{b['id']}/cancel", headers=admin, json={"reason": "Artist unwell"})
    ).json()
    assert (cancelled["status"], cancelled["cancelled_by"], cancelled["refund_due"]) == ("cancelled", "admin", True)
    assert (await client.get(f"/api/v1/admin/bookings/{b['id']}", headers=admin)).json()[
        "cancel_reason"
    ] == "Artist unwell"
    assert (await client.get("/api/v1/admin/bookings", headers=customer)).status_code == 403


async def test_admin_overview_counts(client, engine):
    admin, artist, customer = await setup(client, engine)
    a = (await book(client, customer, artist, slot(5, 9))).json()
    b = (await book(client, customer, artist, slot(6, 9))).json()
    await client.post(f"/api/v1/artists/me/bookings/{b['id']}/decline", headers=artist["headers"], json={})

    o = (await client.get("/api/v1/admin/overview", headers=admin)).json()
    assert o["bookings_30d"] == 2
    assert o["gross_paise_30d"] == a["total_paise"]  # the declined one isn't gross
    assert o["awaiting_artist"] == 1
    assert o["completed_30d"] == 0
    assert o["cancelled_30d"] == 0
    assert o["pending_artists"] == 0
    assert o["pending_custom_services"] == 0
    assert len(o["bookings_by_week"]) == 12
    assert o["bookings_by_week"][-1]["count"] == 2
    assert sum(w["count"] for w in o["bookings_by_week"]) == 2


# --- abuse and robustness (security review) -------------------------------------------------------


async def test_customers_hold_at_most_three_unanswered_requests(client, engine):
    _, artist, customer = await setup(client, engine)
    for day in (5, 6, 7):
        assert (await book(client, customer, artist, slot(day, 9))).status_code == 201
    fourth = await book(client, customer, artist, slot(8, 9))
    assert fourth.status_code == 409
    assert (
        fourth.json()["message"] == "You have 3 requests waiting for an answer. Wait for a reply or cancel one first."
    )


async def test_customers_never_see_the_platform_margin(client, engine):
    admin, artist, customer = await setup(client, engine)
    b = (await book(client, customer, artist)).json()
    for shown in (b, (await client.get(f"/api/v1/bookings/{b['id']}", headers=customer)).json()):
        assert shown["commission_paise"] is None
        assert shown["artist_earning_paise"] is None
    as_artist = (await client.get("/api/v1/artists/me/bookings?scope=requests", headers=artist["headers"])).json()[
        "items"
    ][0]
    assert as_artist["artist_earning_paise"] == 495000
    assert (await client.get(f"/api/v1/admin/bookings/{b['id']}", headers=admin)).json()["commission_paise"] == 55000


async def test_bad_cursors_and_far_dates_are_rejected_cleanly(client, engine):
    import base64

    _, artist, customer = await setup(client, engine)
    naive = base64.urlsafe_b64encode(b"2026-10-17T10:00:00|00000000-0000-0000-0000-000000000000").decode()
    assert (await client.get(f"/api/v1/artists?cursor={naive}")).status_code == 422
    assert (await client.get("/api/v1/artists?cursor=%%%")).status_code == 422
    assert (await book(client, customer, artist, "9999-12-31T23:00:00+00:00")).status_code == 422


async def test_a_request_close_to_its_start_must_be_answered_before_it(client, engine, travel):
    _, artist, customer = await setup(client, engine)
    start = slot(5, 11)
    travel(at(start, -2))  # booked 2 h ahead: the 3 h window would run past the start
    b = (await book(client, customer, artist, start)).json()
    assert b["expires_at"] == b["start_at"]
    travel(at(start, 0.5))
    assert (
        await client.post(f"/api/v1/artists/me/bookings/{b['id']}/accept", headers=artist["headers"])
    ).status_code == 409


async def test_calendar_and_reason_inputs_are_validated(client, engine):
    admin, artist, customer = await setup(client, engine)
    far = await client.get("/api/v1/artists/me/bookings?to=9999-12-31", headers=artist["headers"])
    assert far.status_code == 422
    b = (await book(client, customer, artist)).json()
    blank = await client.post(f"/api/v1/admin/bookings/{b['id']}/cancel", headers=admin, json={"reason": "   "})
    assert blank.status_code == 422


async def test_direct_upi_bookings_record_amounts_but_no_payment(client, engine, override):
    """With PAYMENT_PROVIDER=direct the customer pays the artist's UPI: nothing is marked as received."""
    override(get_booking_settings, lambda: BookingSettings(environment="production", payment_provider="direct"))
    _, artist, customer = await setup(client, engine)
    b = (await book(client, customer, artist)).json()
    assert (b["status"], b["deposit_paise"], b["deposit_paid_at"]) == ("requested", 168000, None)


async def test_the_database_refuses_overlapping_active_bookings_for_one_artist(client, engine):
    """Defence in depth: even a write that skips the service's checks can't double-book an artist."""
    import sqlalchemy.exc

    _, artist, customer = await setup(client, engine)
    b = (await book(client, customer, artist)).json()
    with pytest.raises(sqlalchemy.exc.IntegrityError, match="ex_booking_no_overlap"):
        async with engine.begin() as conn:
            await conn.execute(
                text(
                    "INSERT INTO booking (code, customer_id, artist_id, service_name, duration_minutes, start_at, "
                    "end_at, address, status, subtotal_paise, platform_fee_paise, total_paise, deposit_paise, "
                    "commission_paise, payment_provider, expires_at) SELECT 'BK-OVRLAP', customer_id, artist_id, "
                    "service_name, duration_minutes, start_at + interval '1 hour', end_at + interval '1 hour', "
                    "address, 'confirmed', 0, 0, 0, 0, 0, 'mock', expires_at FROM booking WHERE id = :id"
                ),
                {"id": b["id"]},
            )
