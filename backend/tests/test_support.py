"""Support contract: a signed-in user reports a problem (about a booking or their account) and follows the
thread; admins work a queue (views, counts, KPIs), reply, assign, set priority and close."""

import pytest_asyncio

from tests.support.auth import sign_in
from tests.support.booking import book, setup
from tests.support.catalog import seed_categories

MINE = "/api/v1/support/tickets"
QUEUE = "/api/v1/admin/support/tickets"


@pytest_asyncio.fixture(autouse=True)
async def categories_seeded(engine):
    await seed_categories(engine)


async def report(client, headers, **body):
    payload = {"topic": "account", "issue": "cant_log_in", **body}
    return await client.post(MINE, headers=headers, json=payload)


async def test_customer_reports_a_booking_problem_and_sees_it(client, engine):
    _, artist, customer = await setup(client, engine)
    b = (await book(client, customer, artist)).json()

    created = await report(
        client, customer, topic="booking", booking_id=b["id"], issue="artist_no_show", details="Waited an hour"
    )
    mine = (await client.get(MINE, headers=customer)).json()["items"]

    assert created.status_code == 201, created.text
    t = created.json()
    assert t["code"].startswith("T-")
    assert (t["subject"], t["status"], t["priority"]) == ("Artist didn't show up", "new", "urgent")
    assert t["booking"]["code"] == b["code"]
    assert [m["text"] for m in t["messages"]] == ["Waited an hour"]
    assert [i["id"] for i in mine] == [t["id"]]


async def test_artist_reports_a_customer_no_show_and_the_reply_opens_their_side(client, engine):
    admin, artist, customer = await setup(client, engine)
    b = (await book(client, customer, artist)).json()

    created = await report(client, artist["headers"], topic="booking", booking_id=b["id"], issue="customer_no_show")
    assert created.status_code == 201, created.text
    t = created.json()
    assert (t["subject"], t["priority"], t["booking"]["code"]) == ("Customer didn't show up", "urgent", b["code"])
    assert (await client.get(QUEUE, headers=admin, params={"view": "artists"})).json()["items"][0]["id"] == t["id"]

    await client.post(f"{QUEUE}/{t['id']}/reply", headers=admin, json={"text": "We've called the customer."})
    inbox = (await client.get("/api/v1/notifications", headers=artist["headers"])).json()["items"]
    assert [n["link"] for n in inbox if n["kind"] == "support_reply"] == [f"/artist/support/{t['id']}"]


async def test_nobody_reports_a_booking_that_is_not_theirs(client, engine):
    _, artist, customer = await setup(client, engine)
    b = (await book(client, customer, artist)).json()
    stranger = await sign_in(client, "+919845077777", role="customer")
    response = await report(client, stranger, topic="booking", booking_id=b["id"], issue="other")
    assert response.status_code == 404


async def test_reports_are_validated(client, engine):
    _, artist, customer = await setup(client, engine)
    stranger = await sign_in(client, "+919845080002", role="customer")
    b = (await book(client, customer, artist)).json()

    wrong_issue = await report(client, customer, topic="account", issue="artist_no_show")
    no_booking = await report(client, customer, topic="booking", issue="artist_no_show")
    not_theirs = await report(client, stranger, topic="booking", booking_id=b["id"], issue="artist_no_show")
    too_long = await report(client, customer, details="x" * 501)

    assert [r.status_code for r in (wrong_issue, no_booking, too_long)] == [422, 422, 422]
    assert not_theirs.status_code == 404


async def test_admin_queue_views_counts_and_kpis(client, engine):
    admin, artist, customer = await setup(client, engine)
    b = (await book(client, customer, artist)).json()
    urgent = (await report(client, customer, topic="booking", booking_id=b["id"], issue="artist_no_show")).json()
    from_artist = (await report(client, artist["headers"], issue="change_number")).json()

    open_view = (await client.get(QUEUE, headers=admin)).json()["items"]
    artists = (await client.get(QUEUE, headers=admin, params={"view": "artists"})).json()["items"]
    urgent_view = (await client.get(QUEUE, headers=admin, params={"view": "urgent"})).json()["items"]
    summary = (await client.get("/api/v1/admin/support/summary", headers=admin)).json()

    assert {t["id"] for t in open_view} == {urgent["id"], from_artist["id"]}
    assert [t["id"] for t in artists] == [from_artist["id"]]
    assert [t["id"] for t in urgent_view] == [urgent["id"]]
    assert open_view[0]["requester"]["side"] in ("customer", "artist")
    assert summary["counts"] == {"open": 2, "mine": 0, "artists": 1, "customers": 1, "urgent": 1, "resolved": 0}


async def test_reply_assign_and_close_flow_back_to_the_requester(client, engine):
    admin, _, customer = await setup(client, engine)
    t = (await report(client, customer, details="I can't sign in")).json()
    url = f"{QUEUE}/{t['id']}"

    assigned = await client.post(f"{url}/assign", headers=admin)
    replied = await client.post(f"{url}/reply", headers=admin, json={"text": "Try the new code we just sent."})
    seen = (await client.get(f"{MINE}/{t['id']}", headers=customer)).json()
    answered = await client.post(f"{MINE}/{t['id']}/messages", headers=customer, json={"text": "Worked, thanks!"})
    closed = await client.post(f"{url}/close", headers=admin)
    mine_view = (await client.get(QUEUE, headers=admin, params={"view": "mine"})).json()["items"]
    resolved = (await client.get(QUEUE, headers=admin, params={"view": "resolved"})).json()["items"]
    summary = (await client.get("/api/v1/admin/support/summary", headers=admin)).json()

    assert assigned.json()["assignee"]["name"]
    assert replied.json()["status"] == "waiting_on_user"
    assert [m["author"] for m in seen["messages"]] == ["requester", "support"]
    assert answered.json()["status"] == "open"
    assert closed.json()["status"] == "resolved"
    assert mine_view == []  # resolved tickets leave the working views
    assert [r["id"] for r in resolved] == [t["id"]]
    assert summary["first_response_minutes"] is not None
    assert summary["resolved_7d"] == 1


async def test_writing_to_a_resolved_ticket_reopens_it(client, engine):
    admin, _, customer = await setup(client, engine)
    t = (await report(client, customer)).json()
    await client.post(f"{QUEUE}/{t['id']}/close", headers=admin)

    again = await client.post(f"{MINE}/{t['id']}/messages", headers=customer, json={"text": "Still broken"})

    assert again.json()["status"] == "open"


async def test_admin_sets_priority_and_opens_a_ticket_for_a_phone_request(client, engine):
    admin, _, customer = await setup(client, engine)
    t = (await report(client, customer)).json()

    urgent = await client.patch(f"{QUEUE}/{t['id']}", headers=admin, json={"priority": "urgent"})
    created = await client.post(
        QUEUE,
        headers=admin,
        json={"phone": "+919845080001", "topic": "account", "issue": "change_number", "message": "Called in"},
    )
    unknown = await client.post(
        QUEUE, headers=admin, json={"phone": "+919800000000", "topic": "account", "issue": "other", "message": "x"}
    )

    assert urgent.json()["priority"] == "urgent"
    assert created.status_code == 201, created.text
    assert (created.json()["channel"], created.json()["requester"]["phone"]) == ("phone", "+919845080001")
    assert unknown.status_code == 404


async def test_people_see_only_their_own_tickets(client, engine):
    _, _, customer = await setup(client, engine)
    stranger = await sign_in(client, "+919845080002", role="customer")
    t = (await report(client, customer)).json()

    assert (await client.get(f"{MINE}/{t['id']}", headers=stranger)).status_code == 404
    assert (await client.post(f"{MINE}/{t['id']}/messages", headers=stranger, json={"text": "hi"})).status_code == 404
    assert (await client.get(QUEUE, headers=customer)).status_code == 403


async def test_reporting_is_rate_limited(client, engine, override):
    from app.core.rate_limit import Limit
    from app.support.dependencies import tickets_per_user

    _, _, customer = await setup(client, engine)
    override(tickets_per_user, lambda: Limit(hits=1, window_seconds=3600))

    assert (await report(client, customer)).status_code == 201
    assert (await report(client, customer)).status_code == 429
