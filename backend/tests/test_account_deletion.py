"""Account deletion ("anonymise now"): DELETE /users/me cancels what is still open, takes an artist out of
the directory with their photos and KYC, ends every session, and anonymises the account in place so past
bookings, orders and reviews keep pointing at it. The same phone can then sign up again as a new account."""

import pytest_asyncio
from sqlalchemy import text

from app.upload.service import FakeStorage
from tests.support.auth import CUSTOMER_PHONE, sign_in
from tests.support.booking import at, book, setup
from tests.support.catalog import seed_categories
from tests.support.directory import slot
from tests.support.upload import upload_key

ME = "/api/v1/users/me"
INBOX = "/api/v1/notifications"
SHOP = "/api/v1/shop"
MY_SHOP = "/api/v1/artists/me/shop"


@pytest_asyncio.fixture(autouse=True)
async def categories_seeded(engine):
    await seed_categories(engine)


async def kinds(client, headers) -> list[str]:
    return [n["kind"] for n in (await client.get(INBOX, headers=headers)).json()["items"]]


async def open_shop(client, artist: dict) -> dict:
    await client.put(
        f"{MY_SHOP}/settings", headers=artist["headers"], json={"pay_on_delivery": True, "pay_before_shipping": False}
    )
    key = await upload_key(client, artist["headers"], "shop")
    product = await client.post(
        f"{MY_SHOP}/products",
        headers=artist["headers"],
        json={
            "name": "Organic henna cones",
            "category": "henna",
            "price_paise": 48000,
            "stock": 5,
            "photos": [{"key": key, "width": 1200, "height": 1200}],
        },
    )
    assert product.status_code == 201, product.text
    return product.json()


async def place_order(client, customer: dict, artist: dict, product: dict) -> dict:
    response = await client.post(
        f"{SHOP}/orders",
        headers=customer,
        json={
            "items": [{"product_id": product["id"], "quantity": 2}],
            "address": "Flat 1204, Prestige Acropolis, Koramangala, Bangalore 560034",
            "payment_methods": {artist["id"]: "pay_on_delivery"},
        },
    )
    assert response.status_code == 201, response.text
    return response.json()[0]


async def test_customer_deletes_their_account(client, engine, travel):
    _, artist, customer = await setup(client, engine)
    await client.patch(ME, headers=customer, json={"first_name": "Priya", "last_name": "S"})
    old_id = (await client.get(ME, headers=customer)).json()["id"]
    done = (await book(client, customer, artist, start=slot(days=5))).json()
    upcoming = (await book(client, customer, artist, start=slot(days=10))).json()
    h = artist["headers"]
    for b in (done, upcoming):
        await client.post(f"/api/v1/artists/me/bookings/{b['id']}/accept", headers=h)
    travel(at(done["start_at"], 4))
    await client.post(f"/api/v1/artists/me/bookings/{done['id']}/complete", headers=h)

    deleted = await client.delete(ME, headers=customer)

    assert deleted.status_code == 204, deleted.text
    assert deleted.content == b""
    assert (await client.get(ME, headers=customer)).status_code == 401
    past = (await client.get("/api/v1/artists/me/bookings?scope=past", headers=h)).json()["items"]
    by_id = {b["id"]: b for b in past}
    assert by_id[done["id"]]["status"] == "completed"
    cancelled = by_id[upcoming["id"]]
    assert (cancelled["status"], cancelled["cancelled_by"], cancelled["cancel_reason"]) == (
        "cancelled",
        "customer",
        "Account deleted",
    )
    assert cancelled["cancelled_at"] is not None
    assert {(b["customer"]["first_name"], b["customer"]["last_name"]) for b in past} == {(None, None)}
    assert "booking_cancelled" in await kinds(client, h)

    again = await sign_in(client, CUSTOMER_PHONE, role="customer")
    fresh = (await client.get(ME, headers=again)).json()
    assert fresh["id"] != old_id
    assert (fresh["phone"], fresh["first_name"], fresh["roles"]) == (CUSTOMER_PHONE, None, ["customer"])
    assert (await client.get("/api/v1/bookings?scope=past", headers=again)).json()["items"] == []


async def test_deleted_account_is_anonymised_in_place_and_signed_out(client, engine):
    customer = await sign_in(client, CUSTOMER_PHONE, role="customer")
    await client.patch(ME, headers=customer, json={"first_name": "Priya", "email": "priya@example.com"})
    user_id = (await client.get(ME, headers=customer)).json()["id"]
    await client.post(f"{INBOX}/devices", headers=customer, json={"token": "ExponentPushToken[abc]", "platform": "ios"})

    assert (await client.delete(ME, headers=customer)).status_code == 204

    async with engine.connect() as conn:
        row = (
            await conn.execute(
                text(
                    "SELECT phone, email, first_name, last_name, avatar_url, password_hash, is_active, active_role "
                    "FROM user_account WHERE id = :id"
                ),
                {"id": user_id},
            )
        ).one()
        counts = [
            (await conn.execute(text(sql), {"id": user_id})).scalar()
            for sql in (
                "SELECT count(*) FROM auth_refresh_token WHERE user_id = :id",
                "SELECT count(*) FROM notification_push_device WHERE user_id = :id",
                "SELECT count(*) FROM notification WHERE user_id = :id",
                "SELECT count(*) FROM user_role_grant WHERE user_id = :id",
            )
        ]
    assert row.phone.startswith("del-") and len(row.phone) <= 20
    assert (row.email, row.first_name, row.last_name, row.avatar_url, row.password_hash) == (None,) * 5
    assert (row.is_active, row.active_role) == (False, None)
    assert counts == [0, 0, 0, 0]


async def test_deleting_needs_a_live_session(client):
    customer = await sign_in(client, CUSTOMER_PHONE, role="customer")

    assert (await client.delete(ME)).status_code == 401
    assert (await client.delete(ME, headers=customer)).status_code == 204
    assert (await client.delete(ME, headers=customer)).status_code == 401


async def test_artist_deletes_their_account(client, engine):
    _, artist, customer = await setup(client, engine)
    h = artist["headers"]
    booking = (await book(client, customer, artist)).json()
    product = await open_shop(client, artist)
    order = await place_order(client, customer, artist, product)
    key = await upload_key(client, h, "post")
    post = await client.post(
        "/api/v1/artists/me/posts",
        headers=h,
        json={"kind": "photos", "text": "Bridal set", "photos": [{"key": key, "width": 1080, "height": 1350}]},
    )
    assert post.status_code == 201, post.text
    async with engine.connect() as conn:
        public = set(
            (
                await conn.execute(
                    text(
                        "SELECT photo_key FROM artist_profile WHERE id = :a "
                        "UNION SELECT storage_key FROM artist_portfolio_photo WHERE artist_id = :a"
                    ),
                    {"a": artist["id"]},
                )
            ).scalars()
        )
        kyc = (
            await conn.execute(
                text("SELECT front_key, back_key FROM artist_kyc WHERE artist_id = :a"), {"a": artist["id"]}
            )
        ).one()
    FakeStorage.deleted.clear()

    assert (await client.delete(ME, headers=h)).status_code == 204

    assert artist["id"] not in [a["id"] for a in (await client.get("/api/v1/artists")).json()["items"]]
    mine = (await client.get(f"/api/v1/bookings/{booking['id']}", headers=customer)).json()
    assert (mine["status"], mine["cancelled_by"], mine["cancel_reason"]) == ("cancelled", "artist", "Account deleted")
    assert mine["artist"]["business_name"] == "Deleted artist"
    assert {"booking_cancelled", "order_cancelled"} <= set(await kinds(client, customer))
    my_order = (await client.get(f"{SHOP}/orders/{order['id']}", headers=customer)).json()
    assert (my_order["status"], my_order["cancelled_by"]) == ("cancelled", "artist")
    assert set(FakeStorage.deleted) >= public | {kyc.front_key, kyc.back_key, key}
    assert len(public) == 7  # profile photo + six portfolio photos
    async with engine.connect() as conn:
        left = [
            (await conn.execute(text(sql), {"a": artist["id"]})).scalar()
            for sql in (
                "SELECT count(*) FROM artist_kyc WHERE artist_id = :a",
                "SELECT count(*) FROM artist_portfolio_photo WHERE artist_id = :a",
                "SELECT count(*) FROM feed_post WHERE artist_id = :a",
                "SELECT count(*) FROM shop_product WHERE artist_id = :a AND is_active",
                "SELECT count(*) FROM artist_service_item WHERE artist_id = :a",
            )
        ]
        profile = (
            await conn.execute(
                text("SELECT status, business_name, bio, photo_key FROM artist_profile WHERE id = :a"),
                {"a": artist["id"]},
            )
        ).one()
        stock = (
            await conn.execute(text("SELECT stock FROM shop_product WHERE id = :p"), {"p": product["id"]})
        ).scalar()
    assert left == [0, 0, 0, 0, 1]  # services stay for booking history
    assert tuple(profile) == ("suspended", "Deleted artist", None, None)
    assert stock == 5  # the cancelled order gave its stock back


async def test_customer_deletion_cancels_their_open_shop_orders(client, engine):
    _, artist, customer = await setup(client, engine)
    product = await open_shop(client, artist)
    order = await place_order(client, customer, artist, product)

    assert (await client.delete(ME, headers=customer)).status_code == 204

    theirs = (await client.get(f"{MY_SHOP}/orders", headers=artist["headers"])).json()["items"]
    assert [(o["id"], o["status"], o["cancelled_by"]) for o in theirs] == [(order["id"], "cancelled", "customer")]
    assert "order_cancelled" in await kinds(client, artist["headers"])
    async with engine.connect() as conn:
        stock = (
            await conn.execute(text("SELECT stock FROM shop_product WHERE id = :p"), {"p": product["id"]})
        ).scalar()
    assert stock == 5
