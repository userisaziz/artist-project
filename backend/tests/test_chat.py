"""Chat contract: a customer messages an approved artist; the artist replies, or opens a chat from a booking.
One conversation per customer–artist pair; each side reads only its own; unread counts follow read marks."""

from datetime import UTC, datetime, timedelta

import pytest_asyncio
from sqlalchemy import text

from tests.support.artist import approved_artist, submitted_artist_id
from tests.support.auth import sign_in
from tests.support.booking import book, setup
from tests.support.catalog import seed_categories

NOW = datetime(2026, 10, 9, 9, 0, tzinfo=UTC)


@pytest_asyncio.fixture(autouse=True)
async def categories_seeded(engine):
    await seed_categories(engine)


async def open_chat(client, customer: dict, artist_id: str):
    return await client.post("/api/v1/conversations", headers=customer, json={"artist_id": artist_id})


async def send(client, headers: dict, conversation_id: str, body: str, side: str = "customer"):
    base = "/api/v1/conversations" if side == "customer" else "/api/v1/artists/me/conversations"
    return await client.post(f"{base}/{conversation_id}/messages", headers=headers, json={"text": body})


async def test_customer_opens_one_conversation_per_artist(client, engine):
    _, artist, customer = await setup(client, engine)

    first = await open_chat(client, customer, artist["id"])
    again = await open_chat(client, customer, artist["id"])

    assert first.status_code == 200, first.text
    c = first.json()
    assert again.json()["id"] == c["id"]
    assert c["counterpart"]["id"] == artist["id"]
    assert c["counterpart"]["name"] == "Ayesha Mehendi Art"
    assert c["counterpart"]["photo_url"]
    assert (c["last_message"], c["unread_count"], c["booking"]) == (None, 0, None)


async def test_only_approved_artists_can_be_messaged(client, engine):
    _, _, customer = await setup(client, engine)
    pending_id = await submitted_artist_id(client, "+919845066602")

    response = await open_chat(client, customer, pending_id)

    assert response.status_code == 404


async def test_an_artist_cannot_message_their_own_profile(client, engine):
    _, artist, _ = await setup(client, engine)
    await client.put("/api/v1/users/me/role", headers=artist["headers"], json={"role": "customer"})

    response = await open_chat(client, artist["headers"], artist["id"])

    assert response.status_code == 409


async def test_messages_flow_both_ways_newest_first(client, engine, travel):
    _, artist, customer = await setup(client, engine)
    c = (await open_chat(client, customer, artist["id"])).json()
    travel(NOW)
    asked = await send(client, customer, c["id"], "  Can you hide our initials in the design?  ")
    travel(NOW + timedelta(minutes=2))
    replied = await send(client, artist["headers"], c["id"], "Of course 💗", side="artist")

    assert asked.status_code == 201, asked.text
    assert (asked.json()["text"], asked.json()["sender"]) == ("Can you hide our initials in the design?", "customer")
    assert replied.json()["sender"] == "artist"
    for headers, path in (
        (customer, f"/api/v1/conversations/{c['id']}/messages"),
        (artist["headers"], f"/api/v1/artists/me/conversations/{c['id']}/messages"),
    ):
        page = (await client.get(path, headers=headers)).json()
        assert [m["text"] for m in page["items"]] == ["Of course 💗", "Can you hide our initials in the design?"]
        assert page["next_cursor"] is None


async def test_messages_page_with_a_cursor(client, engine, travel):
    _, artist, customer = await setup(client, engine)
    c = (await open_chat(client, customer, artist["id"])).json()
    for i in range(5):
        travel(NOW + timedelta(minutes=i))
        await send(client, customer, c["id"], f"m{i}")

    path = f"/api/v1/conversations/{c['id']}/messages"
    first = (await client.get(path, headers=customer, params={"limit": 3})).json()
    rest = (await client.get(path, headers=customer, params={"limit": 3, "cursor": first["next_cursor"]})).json()

    assert [m["text"] for m in first["items"]] == ["m4", "m3", "m2"]
    assert [m["text"] for m in rest["items"]] == ["m1", "m0"]
    assert rest["next_cursor"] is None


async def test_blank_or_overlong_messages_are_rejected(client, engine):
    _, artist, customer = await setup(client, engine)
    c = (await open_chat(client, customer, artist["id"])).json()

    assert (await send(client, customer, c["id"], "   ")).status_code == 422
    assert (await send(client, customer, c["id"], "x" * 2001)).status_code == 422


async def test_artist_inbox_lists_only_conversations_with_messages(client, engine, travel):
    _, artist, customer = await setup(client, engine)
    async with engine.begin() as conn:
        await conn.execute(
            text("UPDATE user_account SET first_name='Ananya', last_name='Rao' WHERE phone='+919845080001'")
        )
    c = (await open_chat(client, customer, artist["id"])).json()
    inbox = "/api/v1/artists/me/conversations"
    assert (await client.get(inbox, headers=artist["headers"])).json()["items"] == []

    travel(NOW)
    await send(client, customer, c["id"], "Hi!")
    travel(NOW + timedelta(seconds=30))
    await send(client, customer, c["id"], "22 guests, starting at 5 PM")
    items = (await client.get(inbox, headers=artist["headers"])).json()["items"]

    assert len(items) == 1
    row = items[0]
    assert row["counterpart"]["name"] == "Ananya Rao"
    assert row["last_message"]["text"] == "22 guests, starting at 5 PM"
    assert row["last_message"]["sender"] == "customer"
    assert row["unread_count"] == 2


async def test_reading_clears_unread_and_sending_counts_as_read(client, engine, travel):
    _, artist, customer = await setup(client, engine)
    c = (await open_chat(client, customer, artist["id"])).json()
    travel(NOW)
    await send(client, customer, c["id"], "Hi!")
    travel(NOW + timedelta(minutes=1))

    read = await client.post(f"/api/v1/artists/me/conversations/{c['id']}/read", headers=artist["headers"])
    assert read.status_code == 200
    assert read.json()["unread_count"] == 0

    travel(NOW + timedelta(minutes=2))
    await send(client, artist["headers"], c["id"], "Hello!", side="artist")
    mine = (await client.get("/api/v1/conversations", headers=customer)).json()["items"][0]
    theirs = (await client.get("/api/v1/artists/me/conversations", headers=artist["headers"])).json()["items"][0]
    assert (mine["unread_count"], theirs["unread_count"]) == (1, 0)


async def test_inbox_is_ordered_by_latest_message_and_searchable(client, engine, travel):
    _, artist, customer = await setup(client, engine)
    other = await sign_in(client, "+919845080002", role="customer")
    async with engine.begin() as conn:
        await conn.execute(text("UPDATE user_account SET first_name='Rhea' WHERE phone='+919845080002'"))
    c1 = (await open_chat(client, customer, artist["id"])).json()
    c2 = (await open_chat(client, other, artist["id"])).json()
    travel(NOW)
    await send(client, other, c2["id"], "first")
    travel(NOW + timedelta(minutes=1))
    await send(client, customer, c1["id"], "second")

    inbox = "/api/v1/artists/me/conversations"
    ordered = (await client.get(inbox, headers=artist["headers"])).json()["items"]
    found = (await client.get(inbox, headers=artist["headers"], params={"q": "rhe"})).json()["items"]
    paged = (await client.get(inbox, headers=artist["headers"], params={"limit": 1})).json()
    rest = (
        await client.get(inbox, headers=artist["headers"], params={"limit": 1, "cursor": paged["next_cursor"]})
    ).json()

    assert [i["id"] for i in ordered] == [c1["id"], c2["id"]]
    assert [i["id"] for i in found] == [c2["id"]]
    assert [i["id"] for i in paged["items"] + rest["items"]] == [c1["id"], c2["id"]]


async def test_artist_opens_a_chat_from_a_booking_and_sees_its_tag(client, engine):
    _, artist, customer = await setup(client, engine)
    b = (await book(client, customer, artist)).json()

    opened = await client.post(
        "/api/v1/artists/me/conversations", headers=artist["headers"], json={"booking_id": b["id"]}
    )
    from_customer = (await open_chat(client, customer, artist["id"])).json()

    assert opened.status_code == 200, opened.text
    c = opened.json()
    assert c["id"] == from_customer["id"]
    assert c["booking"]["id"] == b["id"]
    assert (c["booking"]["status"], c["booking"]["service_name"]) == ("requested", "Bridal Classic")
    assert from_customer["booking"]["id"] == b["id"]


async def test_artist_cannot_open_a_chat_from_someone_elses_booking(client, engine):
    admin, artist, customer = await setup(client, engine)
    rival = await approved_artist(client, engine, "+919845091002", admin, name="Meher by Riya")
    b = (await book(client, customer, artist)).json()

    response = await client.post(
        "/api/v1/artists/me/conversations", headers=rival["headers"], json={"booking_id": b["id"]}
    )

    assert response.status_code == 404


async def test_other_people_cannot_read_or_write_a_conversation(client, engine):
    admin, artist, customer = await setup(client, engine)
    rival = await approved_artist(client, engine, "+919845091002", admin, name="Meher by Riya")
    stranger = await sign_in(client, "+919845080003", role="customer")
    c = (await open_chat(client, customer, artist["id"])).json()

    assert (await client.get(f"/api/v1/conversations/{c['id']}/messages", headers=stranger)).status_code == 404
    assert (await send(client, stranger, c["id"], "hi")).status_code == 404
    rival_read = await client.get(f"/api/v1/artists/me/conversations/{c['id']}/messages", headers=rival["headers"])
    assert rival_read.status_code == 404
    assert (await send(client, rival["headers"], c["id"], "hi", side="artist")).status_code == 404


async def test_chat_needs_the_matching_role(client, engine):
    _, _, customer = await setup(client, engine)

    assert (await client.get("/api/v1/conversations")).status_code in (401, 403)
    assert (await client.get("/api/v1/artists/me/conversations", headers=customer)).status_code == 403


async def test_each_side_reads_one_conversation_from_its_own_view(client, engine):
    admin, artist, customer = await setup(client, engine)
    rival = await approved_artist(client, engine, "+919845091002", admin, name="Meher by Riya")
    c = (await open_chat(client, customer, artist["id"])).json()

    mine = await client.get(f"/api/v1/conversations/{c['id']}", headers=customer)
    theirs = await client.get(f"/api/v1/artists/me/conversations/{c['id']}", headers=artist["headers"])
    other = await client.get(f"/api/v1/artists/me/conversations/{c['id']}", headers=rival["headers"])

    assert mine.status_code == 200
    assert mine.json()["counterpart"]["name"] == "Ayesha Mehendi Art"
    assert theirs.json()["counterpart"]["name"] == "Atelier customer"
    assert other.status_code == 404
