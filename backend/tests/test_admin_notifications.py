"""Admin notifications: events that need an admin's attention (an artist to review, a support ticket, a
reported post, a subcategory suggestion) land once in every active admin's inbox, with an admin-console link.
Admins work in the web console, so nothing is pushed to their devices."""

import pytest_asyncio
from sqlalchemy import text

from app.notification.push import ConsolePushProvider
from tests.support.artist import approved_artist, complete_profile
from tests.support.auth import admin_headers, sign_in
from tests.support.booking import book, setup
from tests.support.catalog import categories, seed_categories
from tests.support.upload import upload_key

INBOX = "/api/v1/notifications"
TICKETS = "/api/v1/support/tickets"
ADMIN_KINDS = {"artist_submitted", "ticket_opened", "post_reported", "subcategory_suggested"}
SECOND_ADMIN_PHONE = "+919845000002"


@pytest_asyncio.fixture(autouse=True)
async def categories_seeded(engine):
    await seed_categories(engine)
    ConsolePushProvider.sent.clear()


async def inbox(client, headers, kind: str | None = None) -> list[dict]:
    items = (await client.get(INBOX, headers=headers)).json()["items"]
    return [n for n in items if kind is None or n["kind"] == kind]


async def unread(client, headers) -> int:
    return (await client.get(f"{INBOX}/unread-count", headers=headers)).json()["count"]


async def second_admin(client, engine) -> dict:
    return await sign_in(client, SECOND_ADMIN_PHONE, role="admin", engine=engine)


async def register_device(client, headers, token: str) -> None:
    response = await client.post(f"{INBOX}/devices", headers=headers, json={"token": token, "platform": "ios"})
    assert response.status_code == 204, response.text


async def no_admin_kinds(client, *people: dict) -> bool:
    kinds = {n["kind"] for h in people for n in await inbox(client, h)}
    return not kinds & ADMIN_KINDS


async def report_ticket(client, headers, **body):
    return await client.post(TICKETS, headers=headers, json={"topic": "account", "issue": "cant_log_in", **body})


async def post(client, artist) -> dict:
    key = await upload_key(client, artist["headers"], "post")
    response = await client.post(
        "/api/v1/artists/me/posts",
        headers=artist["headers"],
        json={"kind": "photos", "text": "Bridal set", "photos": [{"key": key, "width": 1080, "height": 1350}]},
    )
    assert response.status_code == 201, response.text
    return response.json()


async def test_a_submitted_artist_notifies_every_admin_once_without_pushes(client, engine):
    admins = [await admin_headers(client, engine), await second_admin(client, engine)]
    await register_device(client, admins[0], "ExponentPushToken[admin-phone]")
    artist = await sign_in(client, "+919845070001")
    profile = await complete_profile(client, artist)

    submitted = await client.post("/api/v1/artists/me/submit", headers=artist)

    assert submitted.status_code == 200, submitted.text
    for headers in admins:
        [n] = await inbox(client, headers)
        assert (n["kind"], n["title"], n["link"]) == (
            "artist_submitted",
            "New artist to review",
            f"/artists/{profile['id']}",
        )
        assert n["body"] == "Ayesha Mehendi Art, Bangalore"
        assert await unread(client, headers) == 1
    assert await no_admin_kinds(client, artist)
    assert ConsolePushProvider.sent == []


async def test_a_blocked_admin_is_not_notified(client, engine):
    admin = await admin_headers(client, engine)
    blocked = await second_admin(client, engine)
    async with engine.begin() as conn:
        await conn.execute(
            text("UPDATE user_account SET is_active = false WHERE phone = :p"), {"p": SECOND_ADMIN_PHONE}
        )
    artist = await sign_in(client, "+919845070002")
    await complete_profile(client, artist)

    await client.post("/api/v1/artists/me/submit", headers=artist)

    assert len(await inbox(client, admin, "artist_submitted")) == 1
    async with engine.connect() as conn:
        count = await conn.scalar(
            text("SELECT count(*) FROM notification n JOIN user_account u ON u.id = n.user_id WHERE u.phone = :p"),
            {"p": SECOND_ADMIN_PHONE},
        )
    assert blocked
    assert count == 0


async def test_resubmitting_a_reviewed_profile_is_titled_as_an_edit(client, engine):
    admin = await admin_headers(client, engine)
    artist = await approved_artist(client, engine, "+919845070003", admin)
    assert (await client.post("/api/v1/artists/me/reopen", headers=artist["headers"])).status_code == 200

    resubmitted = await client.post("/api/v1/artists/me/submit", headers=artist["headers"])

    assert resubmitted.status_code == 200, resubmitted.text
    titles = [n["title"] for n in await inbox(client, admin, "artist_submitted")]
    assert titles == ["Artist edited their profile", "New artist to review"]


async def test_a_resubmitted_rejection_is_titled_as_an_edit(client, engine):
    admin = await admin_headers(client, engine)
    artist = await sign_in(client, "+919845070004")
    profile = await complete_profile(client, artist)
    await client.post("/api/v1/artists/me/submit", headers=artist)
    rejected = await client.post(
        f"/api/v1/admin/artists/{profile['id']}/reject", headers=admin, json={"reason": "Photos are blurry"}
    )
    assert rejected.status_code == 200, rejected.text

    await client.post("/api/v1/artists/me/submit", headers=artist)

    titles = [n["title"] for n in await inbox(client, admin, "artist_submitted")]
    assert titles == ["Artist edited their profile", "New artist to review"]


async def test_an_opened_ticket_notifies_every_admin(client, engine):
    admin, artist, customer = await setup(client, engine)
    other_admin = await second_admin(client, engine)

    created = await report_ticket(client, customer)

    assert created.status_code == 201, created.text
    t = created.json()
    for headers in (admin, other_admin):
        [n] = await inbox(client, headers, "ticket_opened")
        assert (n["title"], n["link"]) == ("New support ticket", f"/support?ticket={t['id']}")
        assert n["body"] == f"{t['code']}: {t['subject']}"
    assert await unread(client, other_admin) == 1
    assert await no_admin_kinds(client, customer, artist["headers"])


async def test_an_urgent_ticket_is_titled_urgent(client, engine):
    admin, artist, customer = await setup(client, engine)
    b = (await book(client, customer, artist)).json()

    created = await report_ticket(
        client, artist["headers"], topic="booking", booking_id=b["id"], issue="customer_no_show"
    )

    assert created.status_code == 201, created.text
    [n] = await inbox(client, admin, "ticket_opened")
    assert n["title"] == "Urgent support ticket"


async def test_a_ticket_an_admin_logs_from_a_phone_call_notifies_nobody(client, engine):
    admin, _, customer = await setup(client, engine)

    created = await client.post(
        "/api/v1/admin/support/tickets",
        headers=admin,
        json={"phone": "+919845080001", "topic": "account", "issue": "change_number", "message": "Called in"},
    )

    assert created.status_code == 201, created.text
    assert await inbox(client, admin, "ticket_opened") == []
    assert await no_admin_kinds(client, customer)


async def test_only_the_first_open_report_on_a_post_notifies_admins(client, engine):
    admin, artist, customer = await setup(client, engine)
    other = await sign_in(client, "+919845080002", role="customer")
    p = await post(client, artist)

    await client.post(f"/api/v1/feed/posts/{p['id']}/report", headers=customer, json={"reason": "spam"})
    first = await inbox(client, admin, "post_reported")
    await client.post(f"/api/v1/feed/posts/{p['id']}/report", headers=customer, json={"reason": "spam"})
    await client.post(f"/api/v1/feed/posts/{p['id']}/report", headers=other, json={"reason": "inappropriate"})
    repeated = await inbox(client, admin, "post_reported")
    await client.post(f"/api/v1/admin/feed/posts/{p['id']}/moderate", headers=admin, json={"decision": "keep"})
    third = await sign_in(client, "+919845080003", role="customer")
    await client.post(f"/api/v1/feed/posts/{p['id']}/report", headers=third, json={"reason": "other"})
    after_keep = await inbox(client, admin, "post_reported")

    [n] = first
    assert (n["title"], n["body"], n["link"]) == ("Post reported", "Ayesha Mehendi Art: spam", "/feed?view=reported")
    assert len(repeated) == 1
    assert len(after_keep) == 2  # kept clears the open reports, so a fresh report is news again
    assert await no_admin_kinds(client, customer, other, artist["headers"])


async def test_a_subcategory_suggestion_notifies_every_admin(client, engine):
    admin, artist, _ = await setup(client, engine)
    other_admin = await second_admin(client, engine)
    mehendi = (await categories(client))["mehendi"]

    added = await client.post(
        "/api/v1/artists/me/custom-services",
        headers=artist["headers"],
        json={
            "suggested_subcategory": {"parent_id": mehendi, "name": "Couple portrait", "description": "Portraits"},
            "name": "Couple portrait session",
            "price_paise": 400000,
            "duration_minutes": 120,
        },
    )

    assert added.status_code == 201, added.text
    for headers in (admin, other_admin):
        [n] = await inbox(client, headers, "subcategory_suggested")
        assert (n["title"], n["body"], n["link"]) == (
            "New subcategory suggestion",
            "Couple portrait under Mehendi",
            "/subcategory-requests?status=pending",
        )
    assert await no_admin_kinds(client, artist["headers"])
