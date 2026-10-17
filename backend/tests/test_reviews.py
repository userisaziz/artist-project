"""Review contract: customers rate completed bookings once; artists reply and report; admins moderate.
Ratings show on the directory and storefront from public (published + flagged) reviews only."""

from datetime import datetime, timedelta

import pytest_asyncio
from sqlalchemy import text

from app.shared import clock
from tests.support.artist import approved_artist
from tests.support.auth import sign_in
from tests.support.booking import at, book, setup
from tests.support.catalog import seed_categories
from tests.support.directory import slot


@pytest_asyncio.fixture(autouse=True)
async def categories_seeded(engine):
    await seed_categories(engine)


async def completed_booking(client, artist: dict, customer: dict, monkeypatch, day: int = 5) -> dict:
    b = (await book(client, customer, artist, slot(day, 11))).json()
    await client.post(f"/api/v1/artists/me/bookings/{b['id']}/accept", headers=artist["headers"])
    monkeypatch.setattr(clock, "now", at(b["start_at"], 4))
    done = await client.post(f"/api/v1/artists/me/bookings/{b['id']}/complete", headers=artist["headers"])
    assert done.status_code == 200
    return done.json()


async def review(client, customer: dict, booking_id: str, rating: int = 5, body: str | None = "Beautiful bridal work"):
    return await client.post(
        f"/api/v1/bookings/{booking_id}/review", headers=customer, json={"rating": rating, "text": body}
    )


async def test_customer_reviews_a_completed_booking_once(client, engine, monkeypatch):
    _, artist, customer = await setup(client, engine)
    async with engine.begin() as conn:
        await conn.execute(
            text("UPDATE users SET first_name='Priya', last_name='Srinivasan' WHERE phone='+919845080001'")
        )
    b = await completed_booking(client, artist, customer, monkeypatch)
    shown = (await client.get(f"/api/v1/bookings/{b['id']}", headers=customer)).json()
    assert (shown["can_review"], shown["review"]) == (True, None)

    response = await review(client, customer, b["id"])
    assert response.status_code == 201
    r = response.json()
    assert (r["rating"], r["text"], r["reviewer_name"], r["service_name"], r["status"]) == (
        5,
        "Beautiful bridal work",
        "Priya S.",
        "Bridal Classic",
        "published",
    )

    again = await review(client, customer, b["id"], 4)
    assert again.status_code == 409
    shown = (await client.get(f"/api/v1/bookings/{b['id']}", headers=customer)).json()
    assert shown["can_review"] is False
    assert shown["review"] == {"id": r["id"], "rating": 5, "status": "published"}

    public = (await client.get(f"/api/v1/artists/{artist['id']}/reviews")).json()
    assert [x["id"] for x in public["items"]] == [r["id"]]
    assert "status" not in public["items"][0]
    assert public["summary"] == {"average": 5.0, "count": 1, "distribution": {"5": 1, "4": 0, "3": 0, "2": 0, "1": 0}}
    card = (await client.get("/api/v1/artists")).json()["items"][0]
    assert (card["rating"], card["review_count"]) == (5.0, 1)
    assert (await client.get(f"/api/v1/artists/{artist['id']}")).json()["rating"] == 5.0


async def test_only_completed_own_bookings_within_30_days(client, engine, monkeypatch):
    _, artist, customer = await setup(client, engine)
    open_one = (await book(client, customer, artist, slot(9, 11))).json()
    assert (await review(client, customer, open_one["id"])).status_code == 409

    b = await completed_booking(client, artist, customer, monkeypatch)
    stranger = await sign_in(client, "+919845080009", role="customer")
    assert (await review(client, stranger, b["id"])).status_code == 404

    monkeypatch.setattr(clock, "now", at(b["completed_at"], 24 * 31))
    late = await review(client, customer, b["id"])
    assert late.status_code == 409
    assert late.json()["message"] == "Reviews open for 30 days after the booking"
    assert (await client.get(f"/api/v1/bookings/{b['id']}", headers=customer)).json()["can_review"] is False
    assert (await review(client, customer, b["id"], rating=6)).status_code == 422


async def test_contact_details_hide_a_review_from_the_public(client, engine, monkeypatch):
    admin, artist, customer = await setup(client, engine)
    b = await completed_booking(client, artist, customer, monkeypatch)
    r = (await review(client, customer, b["id"], 1, "Never showed up, call 98450 67890")).json()
    assert r["status"] == "hidden"

    public = (await client.get(f"/api/v1/artists/{artist['id']}/reviews")).json()
    assert public["items"] == []
    assert public["summary"]["count"] == 0
    assert public["summary"]["average"] is None
    assert (await client.get("/api/v1/artists")).json()["items"][0]["review_count"] == 0

    mine = (await client.get("/api/v1/artists/me/reviews", headers=artist["headers"])).json()
    assert [(x["status"], x["flag"]) for x in mine["items"]] == [("hidden", "contact_info")]

    queue = (await client.get("/api/v1/admin/reviews?status=hidden", headers=admin)).json()["items"]
    assert queue[0]["flag"] == "contact_info"
    assert queue[0]["booking"]["code"] == b["code"]
    assert queue[0]["customer"]["phone"] == "+919845080001"
    assert (await client.get("/api/v1/admin/overview", headers=admin)).json()["flagged_reviews"] == 1


async def test_artist_replies_and_reports(client, engine, monkeypatch):
    admin, artist, customer = await setup(client, engine)
    first = await completed_booking(client, artist, customer, monkeypatch, day=5)
    monkeypatch.undo()
    second = await completed_booking(client, artist, customer, monkeypatch, day=6)
    r1 = (await review(client, customer, first["id"], 5)).json()
    r2 = (await review(client, customer, second["id"], 2, "Half the design was missing")).json()
    h = artist["headers"]

    replied = await client.put(f"/api/v1/artists/me/reviews/{r1['id']}/reply", headers=h, json={"text": " Thank you! "})
    assert (replied.json()["reply"], replied.json()["replied_at"] is not None) == ("Thank you!", True)
    public = (await client.get(f"/api/v1/artists/{artist['id']}/reviews")).json()["items"]
    assert {x["id"]: x["reply"] for x in public}[r1["id"]] == "Thank you!"
    cleared = await client.put(f"/api/v1/artists/me/reviews/{r1['id']}/reply", headers=h, json={"text": ""})
    assert cleared.json()["reply"] is None

    reported = await client.post(
        f"/api/v1/artists/me/reviews/{r2['id']}/report",
        headers=h,
        json={"reason": "Customer changed the design on the day"},
    )
    assert (reported.json()["status"], reported.json()["flag"]) == ("flagged", "artist_report")
    assert (
        await client.post(f"/api/v1/artists/me/reviews/{r2['id']}/report", headers=h, json={"reason": "again"})
    ).status_code == 409
    assert (
        len((await client.get(f"/api/v1/artists/{artist['id']}/reviews")).json()["items"]) == 2
    )  # flagged stays public

    other = await approved_artist(client, engine, "+919845091002", admin, name="Henna by Noor")
    assert (
        await client.put(f"/api/v1/artists/me/reviews/{r1['id']}/reply", headers=other["headers"], json={"text": "x"})
    ).status_code == 404
    assert (
        await client.post(
            f"/api/v1/artists/me/reviews/{r1['id']}/report", headers=other["headers"], json={"reason": "x"}
        )
    ).status_code == 404


async def test_admin_decisions(client, engine, monkeypatch):
    admin, artist, customer = await setup(client, engine)
    b = await completed_booking(client, artist, customer, monkeypatch)
    r = (await review(client, customer, b["id"], 1, "Total scam")).json()
    assert r["status"] == "hidden"
    url = f"/api/v1/admin/reviews/{r['id']}/decision"

    published = (await client.post(url, headers=admin, json={"decision": "publish", "note": "Fair complaint"})).json()
    assert (published["status"], published["flag"], published["moderator_note"]) == (
        "published",
        None,
        "Fair complaint",
    )
    assert published["moderated_at"] is not None
    assert (await client.get(f"/api/v1/artists/{artist['id']}/reviews")).json()["summary"]["count"] == 1

    assert (await client.post(url, headers=admin, json={"decision": "hide"})).json()["status"] == "hidden"
    assert (await client.post(url, headers=admin, json={"decision": "remove"})).json()["status"] == "removed"
    final = await client.post(url, headers=admin, json={"decision": "publish"})
    assert final.status_code == 409
    assert (await client.get("/api/v1/artists/me/reviews", headers=artist["headers"])).json()["items"] == []
    assert (await client.post(url, headers=admin, json={"decision": "delete"})).status_code == 422
    assert (await client.post(url, headers=customer, json={"decision": "publish"})).status_code == 403

    by_status = (await client.get("/api/v1/admin/reviews?status=removed", headers=admin)).json()["items"]
    assert [x["id"] for x in by_status] == [r["id"]]


async def test_review_pages_and_summary_math(client, engine, monkeypatch):
    _, artist, customer = await setup(client, engine)
    ids = []
    for day, rating in ((5, 5), (6, 4), (7, 4)):
        monkeypatch.undo()
        b = await completed_booking(client, artist, customer, monkeypatch, day=day)
        ids.append((await review(client, customer, b["id"], rating, None)).json()["id"])

    first = (await client.get(f"/api/v1/artists/{artist['id']}/reviews?limit=2")).json()
    rest = (await client.get(f"/api/v1/artists/{artist['id']}/reviews?limit=2&cursor={first['next_cursor']}")).json()
    assert [x["id"] for x in first["items"] + rest["items"]] == ids[::-1]  # newest first
    assert rest["next_cursor"] is None
    assert first["summary"] == {"average": 4.3, "count": 3, "distribution": {"5": 1, "4": 2, "3": 0, "2": 0, "1": 0}}


def test_window_helper_uses_completion_time():
    from app.review.filters import review_window_open

    done = datetime(2026, 10, 1, 12, tzinfo=clock.now().tzinfo)
    assert review_window_open(done, done + timedelta(days=30))
    assert not review_window_open(done, done + timedelta(days=30, seconds=1))
    assert not review_window_open(None, done)


async def test_follow_ups_from_the_review_code_review(client, engine, monkeypatch):
    admin, artist, customer = await setup(client, engine)
    first = await completed_booking(client, artist, customer, monkeypatch, day=5)
    hidden = (await review(client, customer, first["id"], 1, "call 98450 67890")).json()
    # Artists don't learn the rating of a review that isn't public.
    listed = (await client.get("/api/v1/artists/me/bookings?scope=past", headers=artist["headers"])).json()["items"]
    assert listed[0]["review"] is None

    url = f"/api/v1/admin/reviews/{hidden['id']}/decision"
    noted = (await client.post(url, headers=admin, json={"decision": "hide", "note": "Phone number"})).json()
    assert noted["moderator_note"] == "Phone number"
    kept = (await client.post(url, headers=admin, json={"decision": "hide"})).json()
    assert kept["moderator_note"] == "Phone number"  # omitted: unchanged
    cleared = (await client.post(url, headers=admin, json={"decision": "publish", "note": ""})).json()
    assert cleared["moderator_note"] is None
    listed = (await client.get("/api/v1/artists/me/bookings?scope=past", headers=artist["headers"])).json()["items"]
    assert listed[0]["review"]["rating"] == 1  # public now

    # Replies can't carry contact details either.
    bad = await client.put(
        f"/api/v1/artists/me/reviews/{hidden['id']}/reply",
        headers=artist["headers"],
        json={"text": "Sorry! WhatsApp me on 98450 12345"},
    )
    assert bad.status_code == 422
    assert bad.json()["message"] == "Replies can't include phone numbers, emails, links or blocked words"

    # Publishing a reported review clears the report.
    monkeypatch.undo()
    second = await completed_booking(client, artist, customer, monkeypatch, day=6)
    r2 = (await review(client, customer, second["id"], 3)).json()
    await client.post(
        f"/api/v1/artists/me/reviews/{r2['id']}/report", headers=artist["headers"], json={"reason": "Wrong artist"}
    )
    published = (
        await client.post(f"/api/v1/admin/reviews/{r2['id']}/decision", headers=admin, json={"decision": "publish"})
    ).json()
    assert (published["flag"], published["report_reason"]) == (None, None)


def test_averages_round_half_up():
    from app.review.service import one_decimal

    assert one_decimal(4.25) == 4.3
    assert one_decimal(4.75) == 4.8
    assert one_decimal(17 / 4) == 4.3
