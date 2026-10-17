"""Journey tests: whole multi-actor stories against the real app + real Postgres.

Each test drives one complete flow end to end — a stranger signs up over OTP, onboards,
gets approved, is discovered in the directory, gets booked, paid, completed and reviewed —
crossing the auth/users/artists/catalog/directory/bookings/reviews seams in one take.
Single-rule endpoint behaviour lives in the per-domain suites; drift between features
shows up here.
"""

from datetime import datetime
from zoneinfo import ZoneInfo

import pytest_asyncio

from app.auth.sms import ConsoleSMSProvider
from tests.support.artist import complete_profile
from tests.support.auth import admin_headers, sign_in
from tests.support.booking import at, book, setup
from tests.support.catalog import seed_categories
from tests.support.directory import ist_day, slot

IST = ZoneInfo("Asia/Kolkata")


@pytest_asyncio.fixture(autouse=True)
async def categories_seeded(engine):
    await seed_categories(engine)


async def test_stranger_to_approved_artist_journey(client, engine):
    """Welcome → OTP → sign-up → Choose role → 4-step onboarding → submit → admin approves → discoverable."""
    phone = "+919845077001"
    assert (await client.post("/api/v1/auth/otp/request", json={"phone": phone})).status_code == 204
    code = ConsoleSMSProvider.sent[-1][1].split()[-1]
    tokens = (await client.post("/api/v1/auth/otp/verify", json={"phone": phone, "code": code})).json()
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}
    assert (tokens["user"]["is_onboarded"], tokens["user"]["active_role"]) == (False, None)

    me = (
        await client.patch("/api/v1/users/me", headers=headers, json={"first_name": "Meera", "last_name": "Kulkarni"})
    ).json()
    assert (me["first_name"], me["is_onboarded"]) == ("Meera", False)  # a name alone does not onboard
    me = (await client.put("/api/v1/users/me/role", headers=headers, json={"role": "artist"})).json()
    assert (me["is_onboarded"], me["active_role"]) == (True, "artist")

    draft = await complete_profile(client, headers)  # photo, business, category, city, service, portfolio, KYC
    assert draft["status"] == "draft"
    submitted = (await client.post("/api/v1/artists/me/submit", headers=headers)).json()
    assert submitted["status"] == "pending"
    assert (await client.get("/api/v1/artists")).json()["items"] == []  # the public does not see pending work

    admin = await admin_headers(client, engine)
    queue = (await client.get("/api/v1/admin/artists", headers=admin)).json()["items"]
    assert [q["id"] for q in queue] == [draft["id"]]
    assert (await client.post(f"/api/v1/admin/artists/{draft['id']}/approve", headers=admin)).status_code == 200

    card = (await client.get("/api/v1/artists")).json()["items"][0]
    assert (card["business_name"], card["city"]) == ("Ayesha Mehendi Art", "Bangalore")
    dashboard = (await client.get("/api/v1/artists/me/dashboard", headers=headers)).json()
    assert (dashboard["requests"], dashboard["upcoming"]) == (0, 0)  # the artist home boots empty


async def test_first_booking_to_public_review_journey(client, engine, travel):
    """The flagship story: browse → availability → deposit → accept → complete → rate → reply → public."""
    _, artist, customer = await setup(client, engine)
    # The sign-up screen's name step: without it the review would read "Atelier customer".
    await client.patch("/api/v1/users/me", headers=customer, json={"first_name": "Ananya", "last_name": "Rao"})

    storefront = (await client.get(f"/api/v1/artists/{artist['id']}")).json()
    assert storefront["business_name"] == "Ayesha Mehendi Art"
    day = ist_day(5)
    body = (
        await client.get(f"/api/v1/artists/{artist['id']}/availability?date={day}&service_id={artist['service_id']}")
    ).json()
    free = {datetime.fromisoformat(s["start_at"]).astimezone(IST).hour for s in body["slots"] if s["available"]}
    assert 11 in free

    b = (await book(client, customer, artist, slot(5, 11), note="Lighter palms please")).json()
    assert (b["status"], b["deposit_paise"] > 0, b["artist_earning_paise"]) == (
        "requested",
        True,
        None,
    )  # customers never see the earning
    assert [
        (x["id"], x["status"])
        for x in (await client.get("/api/v1/bookings?scope=upcoming", headers=customer)).json()["items"]
    ] == [(b["id"], "requested")]

    h = artist["headers"]
    dashboard = (await client.get("/api/v1/artists/me/dashboard", headers=h)).json()
    assert dashboard["requests"] == 1
    requests = (await client.get("/api/v1/artists/me/bookings?scope=requests", headers=h)).json()["items"]
    assert requests[0]["artist_earning_paise"] > 0  # the "You earn" line
    assert (await client.post(f"/api/v1/artists/me/bookings/{b['id']}/accept", headers=h)).json()[
        "status"
    ] == "confirmed"

    travel(at(b["start_at"], 4))  # the visit happened
    assert (await client.post(f"/api/v1/artists/me/bookings/{b['id']}/complete", headers=h)).json()[
        "status"
    ] == "completed"
    dashboard = (await client.get("/api/v1/artists/me/dashboard", headers=h)).json()
    past = (await client.get("/api/v1/artists/me/bookings?scope=past", headers=h)).json()["items"]
    assert dashboard["completed_this_month"] == 1
    assert dashboard["earnings_this_month_paise"] == past[0]["artist_earning_paise"]

    shown = (await client.get(f"/api/v1/bookings/{b['id']}", headers=customer)).json()
    assert (shown["can_review"], shown["note"]) == (True, "Lighter palms please")
    r = (
        await client.post(
            f"/api/v1/bookings/{b['id']}/review",
            headers=customer,
            json={"rating": 5, "text": "She hid our initials in the design"},
        )
    ).json()
    assert (r["status"], r["reviewer_name"]) == ("published", "Ananya R.")
    assert (
        await client.post(f"/api/v1/bookings/{b['id']}/review", headers=customer, json={"rating": 4})
    ).status_code == 409

    await client.put(
        f"/api/v1/artists/me/reviews/{r['id']}/reply", headers=h, json={"text": "Thank you! It was a joy."}
    )
    public = (await client.get(f"/api/v1/artists/{artist['id']}/reviews")).json()
    assert public["items"][0]["reply"] == "Thank you! It was a joy."  # the reply is public
    assert public["summary"] == {"average": 5.0, "count": 1, "distribution": {"5": 1, "4": 0, "3": 0, "2": 0, "1": 0}}
    card = (await client.get("/api/v1/artists")).json()["items"][0]
    assert (card["rating"], card["review_count"]) == (5.0, 1)  # the directory card lights up


async def test_decline_frees_the_slot_journey(client, engine):
    """Request → conflict for the next customer → artist declines with a reason → slot reopens, deposit refunded."""
    _, artist, customer = await setup(client, engine)
    first = (await book(client, customer, artist, slot(5, 11))).json()

    other = await sign_in(client, "+919845077002", role="customer")
    clash = await book(client, other, artist, slot(5, 11))
    assert clash.status_code == 409  # the slot is held until the artist answers

    declined = await client.post(
        f"/api/v1/artists/me/bookings/{first['id']}/decline",
        headers=artist["headers"],
        json={"reason": "Travelling that day"},
    )
    assert (declined.json()["status"], declined.json()["refund_due"]) == ("declined", True)
    past = (await client.get("/api/v1/bookings?scope=past", headers=customer)).json()["items"]
    assert [(x["status"], x["decline_reason"]) for x in past] == [("declined", "Travelling that day")]

    reopened = await book(client, other, artist, slot(5, 11))
    assert reopened.status_code == 201  # the window is bookable again


async def test_far_ahead_cancel_refunds_journey(client, engine):
    """Book well ahead → change of plans → cancel: the deposit comes back and the artist learns why."""
    _, artist, customer = await setup(client, engine)
    b = (await book(client, customer, artist, slot(10, 11))).json()
    r = (
        await client.post(f"/api/v1/bookings/{b['id']}/cancel", headers=customer, json={"reason": "Date moved"})
    ).json()
    assert (r["status"], r["refund_due"], r["cancelled_by"]) == ("cancelled", True, "customer")

    artist_past = (await client.get("/api/v1/artists/me/bookings?scope=past", headers=artist["headers"])).json()[
        "items"
    ]
    assert [(x["status"], x["cancel_reason"]) for x in artist_past] == [("cancelled", "Date moved")]
    assert (
        await client.post(f"/api/v1/bookings/{b['id']}/cancel", headers=customer, json={})
    ).status_code == 409  # already over


async def test_review_moderation_journey(client, engine, travel):
    """Hidden for a phone number → published by an admin → reported by the artist → removed: the public only ever counts what is visible."""
    admin, artist, customer = await setup(client, engine)
    h = artist["headers"]

    first = await _completed(client, artist, customer, travel, day=5)
    hidden = (
        await client.post(
            f"/api/v1/bookings/{first['id']}/review",
            headers=customer,
            json={"rating": 1, "text": "Never came, call 98450 67890"},
        )
    ).json()
    assert hidden["status"] == "hidden"
    assert (await client.get(f"/api/v1/artists/{artist['id']}/reviews")).json()["summary"]["count"] == 0

    travel.back()
    second = await _completed(client, artist, customer, travel, day=6)
    good = (
        await client.post(
            f"/api/v1/bookings/{second['id']}/review",
            headers=customer,
            json={"rating": 4, "text": "Beautiful patterns"},
        )
    ).json()
    assert (await client.get(f"/api/v1/artists/{artist['id']}/reviews")).json()["summary"] == {
        "average": 4.0,
        "count": 1,
        "distribution": {"5": 0, "4": 1, "3": 0, "2": 0, "1": 0},
    }

    url = f"/api/v1/admin/reviews/{hidden['id']}/decision"
    published = (await client.post(url, headers=admin, json={"decision": "publish"})).json()
    assert published["status"] == "published"
    assert (await client.get(f"/api/v1/artists/{artist['id']}/reviews")).json()["summary"]["count"] == 2

    reported = (
        await client.post(f"/api/v1/artists/me/reviews/{good['id']}/report", headers=h, json={"reason": "Wrong artist"})
    ).json()
    assert (reported["status"], reported["flag"]) == ("flagged", "artist_report")
    assert (
        len((await client.get(f"/api/v1/artists/{artist['id']}/reviews")).json()["items"]) == 2
    )  # flagged stays public

    removed = (
        await client.post(f"/api/v1/admin/reviews/{good['id']}/decision", headers=admin, json={"decision": "remove"})
    ).json()
    assert removed["status"] == "removed"
    public = (await client.get(f"/api/v1/artists/{artist['id']}/reviews")).json()
    assert [x["id"] for x in public["items"]] == [published["id"]]  # only the restored review remains
    mine = (await client.get("/api/v1/artists/me/reviews", headers=h)).json()["items"]
    assert [x["id"] for x in mine] == [published["id"]]  # the artist never sees removed ones


async def test_customer_becomes_artist_journey(client, engine):
    """Profile → 'Become an artist': the same account grows a second side and switches between them freely."""
    customer = await sign_in(client, "+919845077003", role="customer")
    me = (await client.put("/api/v1/users/me/role", headers=customer, json={"role": "artist"})).json()
    assert (me["roles"], me["active_role"]) == (["customer", "artist"], "artist")

    assert (
        await client.get("/api/v1/artists/me", headers=customer)
    ).status_code == 404  # no profile until the first save
    draft = await complete_profile(client, customer)
    assert draft["status"] == "draft"

    side = (await client.put("/api/v1/users/me/role", headers=customer, json={"role": "customer"})).json()
    assert side["active_role"] == "customer"
    assert (await client.get("/api/v1/bookings?scope=upcoming", headers=customer)).json()[
        "items"
    ] == []  # the customer side still works

    side = (await client.put("/api/v1/users/me/role", headers=customer, json={"role": "artist"})).json()
    assert side["active_role"] == "artist"
    assert (
        await client.get("/api/v1/artists/me/dashboard", headers=customer)
    ).status_code == 409  # the artist area opens only after approval
    assert (await client.post("/api/v1/artists/me/submit", headers=customer)).json()["status"] == "pending"


async def _completed(client, artist: dict, customer: dict, travel, day: int) -> dict:
    """Book, accept, jump past the end, complete: a reviewable booking in `day` days' place on the wall clock."""
    b = (await book(client, customer, artist, slot(day, 11))).json()
    await client.post(f"/api/v1/artists/me/bookings/{b['id']}/accept", headers=artist["headers"])
    travel(at(b["start_at"], 4))
    done = await client.post(f"/api/v1/artists/me/bookings/{b['id']}/complete", headers=artist["headers"])
    assert done.status_code == 200
    return done.json()
