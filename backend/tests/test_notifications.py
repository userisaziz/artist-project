"""Notifications: every event that needs someone's attention lands in their in-app inbox and, when they have
a registered device, goes out as a push (only after the change is saved). Chat notifies on the first unread
message, not every message."""

import json

import httpx
import pytest_asyncio

from app.notification.push import ConsolePushProvider, ExpoPushProvider
from tests.support.auth import sign_in
from tests.support.booking import book, setup
from tests.support.catalog import seed_categories
from tests.support.upload import upload_key

INBOX = "/api/v1/notifications"


@pytest_asyncio.fixture(autouse=True)
async def categories_seeded(engine):
    await seed_categories(engine)
    ConsolePushProvider.sent.clear()


async def inbox(client, headers) -> list[dict]:
    return (await client.get(INBOX, headers=headers)).json()["items"]


async def test_booking_events_reach_the_other_side(client, engine):
    _, artist, customer = await setup(client, engine)

    b = (await book(client, customer, artist)).json()
    requested = await inbox(client, artist["headers"])
    await client.post(f"/api/v1/artists/me/bookings/{b['id']}/accept", headers=artist["headers"])
    accepted = await inbox(client, customer)

    assert requested[0]["kind"] == "booking_requested"
    assert "Bridal Classic" in requested[0]["body"]
    assert requested[0]["link"] == f"/artist/booking/{b['id']}"
    assert accepted[0]["kind"] == "booking_accepted"
    assert accepted[0]["link"] == f"/customer/booking/{b['id']}"


async def test_declines_and_cancellations_are_announced(client, engine):
    _, artist, customer = await setup(client, engine)
    first = (await book(client, customer, artist)).json()
    from tests.support.directory import slot

    second = (await book(client, customer, artist, slot(6, 11))).json()

    await client.post(
        f"/api/v1/artists/me/bookings/{first['id']}/decline", headers=artist["headers"], json={"reason": "Away"}
    )
    await client.post(f"/api/v1/bookings/{second['id']}/cancel", headers=customer, json={"reason": None})

    assert [n["kind"] for n in await inbox(client, customer)] == ["booking_declined"]
    assert "booking_cancelled" in [n["kind"] for n in await inbox(client, artist["headers"])]


async def test_shop_orders_notify_the_seller_and_then_the_customer(client, engine):
    _, artist, customer = await setup(client, engine)
    await client.put(
        "/api/v1/artists/me/shop/settings",
        headers=artist["headers"],
        json={"pay_on_delivery": True, "pay_before_shipping": False},
    )
    key = await upload_key(client, artist["headers"], "shop")
    p = (
        await client.post(
            "/api/v1/artists/me/shop/products",
            headers=artist["headers"],
            json={
                "name": "Henna cones",
                "category": "henna",
                "price_paise": 48000,
                "stock": 5,
                "photos": [{"key": key, "width": 10, "height": 10}],
            },
        )
    ).json()
    o = (
        await client.post(
            "/api/v1/shop/orders",
            headers=customer,
            json={
                "items": [{"product_id": p["id"], "quantity": 1}],
                "address": "Flat 1204, Koramangala, Bangalore",
                "payment_methods": {artist["id"]: "pay_on_delivery"},
            },
        )
    ).json()[0]

    seller = await inbox(client, artist["headers"])
    await client.post(f"/api/v1/artists/me/shop/orders/{o['id']}/confirm", headers=artist["headers"])
    await client.post(
        f"/api/v1/artists/me/shop/orders/{o['id']}/ship", headers=artist["headers"], json={"tracking": None}
    )
    buyer = [n["kind"] for n in await inbox(client, customer)]

    assert seller[0]["kind"] == "order_placed" and seller[0]["link"] == "/artist/shop"
    assert buyer[:2] == ["order_shipped", "order_confirmed"]


async def test_chat_notifies_on_the_first_unread_message_only(client, engine):
    _, artist, customer = await setup(client, engine)
    c = (await client.post("/api/v1/conversations", headers=customer, json={"artist_id": artist["id"]})).json()
    for text in ("Hi!", "Are you free on the 9th?"):
        await client.post(f"/api/v1/conversations/{c['id']}/messages", headers=customer, json={"text": text})

    messages = [n for n in await inbox(client, artist["headers"]) if n["kind"] == "chat_message"]

    assert len(messages) == 1
    assert messages[0]["link"] == f"/artist/chat/{c['id']}"


async def test_support_replies_reach_the_requester(client, engine):
    admin, _, customer = await setup(client, engine)
    t = (
        await client.post(
            "/api/v1/support/tickets", headers=customer, json={"topic": "account", "issue": "cant_log_in"}
        )
    ).json()

    await client.post(f"/api/v1/admin/support/tickets/{t['id']}/reply", headers=admin, json={"text": "Try again now."})
    n = (await inbox(client, customer))[0]

    assert (n["kind"], n["link"]) == ("support_reply", f"/customer/support/{t['id']}")


async def test_push_goes_to_registered_devices_after_saving(client, engine):
    _, artist, customer = await setup(client, engine)
    token = "ExponentPushToken[artist-phone]"
    registered = await client.post(
        f"{INBOX}/devices", headers=artist["headers"], json={"token": token, "platform": "ios"}
    )
    again = await client.post(f"{INBOX}/devices", headers=artist["headers"], json={"token": token, "platform": "ios"})

    await book(client, customer, artist)

    assert (registered.status_code, again.status_code) == (204, 204)
    assert [(m["to"], m["title"]) for m in ConsolePushProvider.sent] == [(token, "New booking request")]


async def test_inbox_counts_unread_and_marks_read(client, engine):
    _, artist, customer = await setup(client, engine)
    await book(client, customer, artist)

    before = (await client.get(f"{INBOX}/unread-count", headers=artist["headers"])).json()
    read = await client.post(f"{INBOX}/read", headers=artist["headers"], json={"ids": None})
    after = (await client.get(f"{INBOX}/unread-count", headers=artist["headers"])).json()

    assert before == {"count": 1}
    assert read.status_code == 204
    assert after == {"count": 0}
    assert (await inbox(client, artist["headers"]))[0]["read_at"] is not None


async def test_people_only_see_their_own_notifications(client, engine):
    _, artist, customer = await setup(client, engine)
    stranger = await sign_in(client, "+919845080003", role="customer")
    await book(client, customer, artist)

    assert await inbox(client, stranger) == []
    assert (await client.get(INBOX)).status_code in (401, 403)


async def test_reading_some_and_removing_a_device(client, engine):
    _, artist, customer = await setup(client, engine)
    token = "ExponentPushToken[old-phone]"
    await client.post(f"{INBOX}/devices", headers=artist["headers"], json={"token": token, "platform": "android"})
    await client.post(
        f"{INBOX}/devices/remove", headers=artist["headers"], json={"token": token, "platform": "android"}
    )
    await book(client, customer, artist)
    first = (await inbox(client, artist["headers"]))[0]

    await client.post(f"{INBOX}/read", headers=artist["headers"], json={"ids": [first["id"]]})

    assert ConsolePushProvider.sent == []
    assert (await client.get(f"{INBOX}/unread-count", headers=artist["headers"])).json() == {"count": 0}


async def test_expo_provider_posts_messages_and_survives_failures():
    seen: list[list[dict]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(json.loads(request.content))
        return httpx.Response(500 if len(seen) > 1 else 200, text="boom")

    def offline(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("offline")

    message = {"to": "ExponentPushToken[x]", "title": "Hi", "body": "There", "data": {}}
    await ExpoPushProvider("https://push.test", 1, httpx.MockTransport(handler))._send([message])
    await ExpoPushProvider("https://push.test", 1, httpx.MockTransport(handler))._send([message])
    await ExpoPushProvider("https://push.test", 1, httpx.MockTransport(offline))._send([message])

    assert seen == [[message], [message]]


async def test_tokens_expo_reports_unregistered_stop_getting_pushes(client, engine):
    _, artist, customer = await setup(client, engine)
    live, dead = "ExponentPushToken[new-phone]", "ExponentPushToken[uninstalled]"
    for token in (live, dead):
        await client.post(f"{INBOX}/devices", headers=artist["headers"], json={"token": token, "platform": "ios"})

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "data": [
                    {"status": "ok", "id": "ticket-1"},
                    {"status": "error", "message": "gone", "details": {"error": "DeviceNotRegistered"}},
                ]
            },
        )

    messages = [{"to": t, "title": "Hi", "body": "There", "data": {}} for t in (live, dead)]
    await ExpoPushProvider("https://push.test", 1, httpx.MockTransport(handler))._send(messages)
    await book(client, customer, artist)

    assert [m["to"] for m in ConsolePushProvider.sent] == [live]


async def test_expo_provider_chunks_batches_over_100():
    batches: list[list[dict]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        batch = json.loads(request.content)
        batches.append(batch)
        return httpx.Response(200, json={"data": [{"status": "ok"} for _ in batch]})

    messages = [{"to": f"ExponentPushToken[{i}]", "title": "Hi", "body": "There", "data": {}} for i in range(250)]
    await ExpoPushProvider("https://push.test", 1, httpx.MockTransport(handler))._send(messages)

    assert [len(b) for b in batches] == [100, 100, 50]
