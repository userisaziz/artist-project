"""Shop contract (phase 1, no in-app payments). Approved artists sell physical products; each artist decides
which payment methods they accept (pay on delivery, pay the artist before shipping) as a shop default that a
product can override. Customers order; orders split by artist, hold stock, and move placed → confirmed →
shipped → delivered (or cancelled). Admins see and manage products and orders."""

import pytest_asyncio

from tests.support.artist import approved_artist
from tests.support.auth import sign_in
from tests.support.booking import setup
from tests.support.catalog import seed_categories
from tests.support.upload import upload_key

MINE = "/api/v1/artists/me/shop"
SHOP = "/api/v1/shop"
ADMIN = "/api/v1/admin/shop"
ADDRESS = "Flat 1204, Prestige Acropolis, Koramangala, Bangalore 560034"


@pytest_asyncio.fixture(autouse=True)
async def categories_seeded(engine):
    await seed_categories(engine)


async def product(client, artist, **extra):
    key = await upload_key(client, artist["headers"], "shop")
    body = {
        "name": "Organic henna cones · 12 pack",
        "description": "Hand-rolled Rajasthani henna",
        "category": "henna",
        "price_paise": 48000,
        "mrp_paise": 60000,
        "stock": 10,
        "photos": [{"key": key, "width": 1200, "height": 1200}],
        **extra,
    }
    response = await client.post(f"{MINE}/products", headers=artist["headers"], json=body)
    assert response.status_code == 201, response.text
    return response.json()


async def order(client, customer, items, methods):
    return await client.post(
        f"{SHOP}/orders",
        headers=customer,
        json={"items": items, "address": ADDRESS, "payment_methods": methods},
    )


async def test_artist_sets_shop_defaults_and_lists_a_product(client, engine):
    _, artist, customer = await setup(client, engine)

    settings = await client.put(
        f"{MINE}/settings",
        headers=artist["headers"],
        json={
            "pay_on_delivery": True,
            "pay_before_shipping": False,
            "delivery_fee_paise": 4900,
            "free_delivery_over_paise": 99900,
        },
    )
    p = await product(client, artist)
    listed = (await client.get(f"{SHOP}/products", headers=customer)).json()["items"]
    detail = (await client.get(f"{SHOP}/products/{p['id']}", headers=customer)).json()

    assert settings.status_code == 200, settings.text
    assert (p["status"], p["is_active"], p["payment_methods"]) == ("live", True, ["pay_on_delivery"])
    assert [i["id"] for i in listed] == [p["id"]]
    assert detail["seller"]["business_name"] == "Ayesha Mehendi Art"
    assert detail["discount_percent"] == 20
    assert detail["photos"][0]["url"].startswith("https://")


async def test_a_product_can_override_the_payment_methods(client, engine):
    _, artist, _ = await setup(client, engine)
    await client.put(
        f"{MINE}/settings", headers=artist["headers"], json={"pay_on_delivery": True, "pay_before_shipping": True}
    )

    p = await product(client, artist, payment_methods=["pay_before_shipping"])

    assert p["payment_methods"] == ["pay_before_shipping"]


async def test_products_are_validated(client, engine):
    _, artist, _ = await setup(client, engine)

    no_photo = await client.post(
        f"{MINE}/products",
        headers=artist["headers"],
        json={"name": "X", "category": "henna", "price_paise": 100, "stock": 1, "photos": []},
    )
    mrp_below = await client.post(
        f"{MINE}/products",
        headers=artist["headers"],
        json={"name": "Kit", "category": "henna", "price_paise": 5000, "mrp_paise": 4000, "stock": 1, "photos": []},
    )
    bad_category = await client.post(
        f"{MINE}/products",
        headers=artist["headers"],
        json={"name": "Kit", "category": "gift_cards", "price_paise": 5000, "stock": 1, "photos": []},
    )
    contact = await client.post(
        f"{MINE}/products",
        headers=artist["headers"],
        json={"name": "Call 9845067890", "category": "henna", "price_paise": 5000, "stock": 1, "photos": []},
    )

    assert [r.status_code for r in (no_photo, mrp_below, bad_category, contact)] == [422, 422, 422, 422]


async def test_ordering_splits_by_artist_holds_stock_and_adds_delivery(client, engine):
    admin, artist, customer = await setup(client, engine)
    other = await approved_artist(client, engine, "+919845091002", admin, name="Meher by Riya", city="Mumbai")
    await client.put(
        f"{MINE}/settings",
        headers=artist["headers"],
        json={
            "pay_on_delivery": True,
            "pay_before_shipping": False,
            "delivery_fee_paise": 4900,
            "free_delivery_over_paise": 99900,
        },
    )
    await client.put(
        f"{MINE}/settings", headers=other["headers"], json={"pay_on_delivery": False, "pay_before_shipping": True}
    )
    cones = await product(client, artist)
    kit = await product(
        client, other, name="Pastel bridal lip kit", category="makeup", price_paise=115000, mrp_paise=None
    )

    placed = await order(
        client,
        customer,
        [{"product_id": cones["id"], "quantity": 2}, {"product_id": kit["id"], "quantity": 1}],
        {artist["id"]: "pay_on_delivery", other["id"]: "pay_before_shipping"},
    )

    assert placed.status_code == 201, placed.text
    orders = {o["seller"]["business_name"]: o for o in placed.json()}
    ayesha, meher = orders["Ayesha Mehendi Art"], orders["Meher by Riya"]
    assert (ayesha["subtotal_paise"], ayesha["delivery_fee_paise"], ayesha["total_paise"]) == (96000, 4900, 100900)
    assert (meher["delivery_fee_paise"], meher["payment_method"]) == (0, "pay_before_shipping")
    assert ayesha["code"].startswith("AT-") and ayesha["status"] == "placed"
    stock = (await client.get(f"{SHOP}/products/{cones['id']}", headers=customer)).json()["stock"]
    assert stock == 8


async def test_orders_refuse_unaccepted_methods_and_short_stock(client, engine):
    _, artist, customer = await setup(client, engine)
    await client.put(
        f"{MINE}/settings", headers=artist["headers"], json={"pay_on_delivery": True, "pay_before_shipping": False}
    )
    p = await product(client, artist, stock=1)

    wrong_method = await order(
        client, customer, [{"product_id": p["id"], "quantity": 1}], {artist["id"]: "pay_before_shipping"}
    )
    too_many = await order(
        client, customer, [{"product_id": p["id"], "quantity": 2}], {artist["id"]: "pay_on_delivery"}
    )

    assert wrong_method.status_code == 409
    assert too_many.status_code == 409


async def test_artist_moves_an_order_through_and_marks_it_paid(client, engine):
    _, artist, customer = await setup(client, engine)
    await client.put(
        f"{MINE}/settings", headers=artist["headers"], json={"pay_on_delivery": False, "pay_before_shipping": True}
    )
    p = await product(client, artist)
    o = (
        await order(client, customer, [{"product_id": p["id"], "quantity": 1}], {artist["id"]: "pay_before_shipping"})
    ).json()[0]
    url = f"{MINE}/orders/{o['id']}"

    confirmed = await client.post(f"{url}/confirm", headers=artist["headers"])
    early_ship = await client.post(f"{url}/ship", headers=artist["headers"], json={"tracking": None})
    paid = await client.post(f"{url}/mark-paid", headers=artist["headers"])
    shipped = await client.post(f"{url}/ship", headers=artist["headers"], json={"tracking": "Delhivery 78294410"})
    delivered = await client.post(f"{url}/deliver", headers=artist["headers"])
    mine = (await client.get(f"{SHOP}/orders/{o['id']}", headers=customer)).json()

    assert confirmed.json()["status"] == "confirmed"
    assert early_ship.status_code == 409  # pay-before-shipping orders ship once paid
    assert paid.json()["paid_at"] is not None
    assert (shipped.json()["status"], shipped.json()["tracking"]) == ("shipped", "Delhivery 78294410")
    assert delivered.json()["status"] == "delivered"
    assert [e["status"] for e in mine["timeline"]] == ["placed", "confirmed", "shipped", "delivered"]


async def test_customer_cancels_before_shipping_and_stock_returns(client, engine):
    _, artist, customer = await setup(client, engine)
    await client.put(
        f"{MINE}/settings", headers=artist["headers"], json={"pay_on_delivery": True, "pay_before_shipping": False}
    )
    p = await product(client, artist, stock=3)
    o = (
        await order(client, customer, [{"product_id": p["id"], "quantity": 2}], {artist["id"]: "pay_on_delivery"})
    ).json()[0]

    cancelled = await client.post(
        f"{SHOP}/orders/{o['id']}/cancel", headers=customer, json={"reason": "Ordered by mistake"}
    )
    stock = (await client.get(f"{SHOP}/products/{p['id']}", headers=customer)).json()["stock"]

    assert (cancelled.json()["status"], cancelled.json()["cancelled_by"]) == ("cancelled", "customer")
    assert stock == 3


async def test_artist_sees_their_orders_and_shop_summary(client, engine):
    _, artist, customer = await setup(client, engine)
    await client.put(
        f"{MINE}/settings", headers=artist["headers"], json={"pay_on_delivery": True, "pay_before_shipping": False}
    )
    p = await product(client, artist)
    await order(client, customer, [{"product_id": p["id"], "quantity": 1}], {artist["id"]: "pay_on_delivery"})

    orders = (await client.get(f"{MINE}/orders", headers=artist["headers"])).json()["items"]
    summary = (await client.get(f"{MINE}/summary", headers=artist["headers"])).json()
    products = (await client.get(f"{MINE}/products", headers=artist["headers"])).json()["items"]

    assert len(orders) == 1 and orders[0]["customer"]["phone"] == "+919845080001"
    assert summary["to_pack"] == 1
    assert products[0]["sold"] == 1


async def test_hidden_or_removed_products_leave_the_shop(client, engine):
    admin, artist, customer = await setup(client, engine)
    a = await product(client, artist)
    b = await product(client, artist, name="Aftercare balm")

    await client.patch(f"{MINE}/products/{a['id']}", headers=artist["headers"], json={"is_active": False})
    removed = await client.post(
        f"{ADMIN}/products/{b['id']}/remove", headers=admin, json={"reason": "Unverified claims"}
    )
    listed = (await client.get(f"{SHOP}/products", headers=customer)).json()["items"]

    assert removed.json()["status"] == "removed"
    assert listed == []
    assert (await client.get(f"{SHOP}/products/{b['id']}", headers=customer)).status_code == 404


async def test_admin_lists_products_and_orders_with_counts(client, engine):
    admin, artist, customer = await setup(client, engine)
    await client.put(
        f"{MINE}/settings", headers=artist["headers"], json={"pay_on_delivery": True, "pay_before_shipping": False}
    )
    p = await product(client, artist, stock=2)
    o = (
        await order(client, customer, [{"product_id": p["id"], "quantity": 1}], {artist["id"]: "pay_on_delivery"})
    ).json()[0]

    products = (await client.get(f"{ADMIN}/products", headers=admin, params={"view": "low_stock"})).json()["items"]
    product_summary = (await client.get(f"{ADMIN}/products/summary", headers=admin)).json()
    to_pack = (await client.get(f"{ADMIN}/orders", headers=admin, params={"view": "to_pack"})).json()["items"]
    updated = await client.post(
        f"{ADMIN}/orders/{o['id']}/status", headers=admin, json={"status": "cancelled", "reason": "Seller unreachable"}
    )
    order_summary = (await client.get(f"{ADMIN}/orders/summary", headers=admin)).json()

    assert [i["id"] for i in products] == [p["id"]]
    assert product_summary["counts"]["live"] == 1
    assert [i["id"] for i in to_pack] == [o["id"]]
    assert (updated.json()["status"], updated.json()["cancelled_by"]) == ("cancelled", "admin")
    assert order_summary["counts"]["cancelled"] == 1


async def test_access_rules(client, engine):
    admin, artist, customer = await setup(client, engine)
    rival = await approved_artist(client, engine, "+919845091002", admin, name="Meher by Riya")
    stranger = await sign_in(client, "+919845080003", role="customer")
    await client.put(
        f"{MINE}/settings", headers=artist["headers"], json={"pay_on_delivery": True, "pay_before_shipping": False}
    )
    p = await product(client, artist)
    o = (
        await order(client, customer, [{"product_id": p["id"], "quantity": 1}], {artist["id"]: "pay_on_delivery"})
    ).json()[0]

    assert (
        await client.patch(f"{MINE}/products/{p['id']}", headers=rival["headers"], json={"stock": 0})
    ).status_code == 404
    assert (await client.post(f"{MINE}/orders/{o['id']}/confirm", headers=rival["headers"])).status_code == 404
    assert (await client.get(f"{SHOP}/orders/{o['id']}", headers=stranger)).status_code == 404
    assert (await client.get(f"{ADMIN}/orders", headers=customer)).status_code == 403
