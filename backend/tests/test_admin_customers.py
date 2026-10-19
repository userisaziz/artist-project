"""Admin customers: the directory (search, segments, counts), one customer's detail, block and unblock.
Phase 1 has no in-app payments, so nothing here reports money spent."""

from datetime import UTC, datetime, timedelta

import pytest_asyncio
from sqlalchemy import text

from tests.support.auth import CUSTOMER_PHONE, sign_in
from tests.support.booking import book, setup
from tests.support.catalog import seed_categories
from tests.support.directory import slot

ADMIN = "/api/v1/admin/customers"


@pytest_asyncio.fixture(autouse=True)
async def categories_seeded(engine):
    await seed_categories(engine)


async def name(engine, phone: str, first: str, last: str | None = None) -> None:
    async with engine.begin() as conn:
        await conn.execute(
            text("UPDATE user_account SET first_name=:f, last_name=:l WHERE phone=:p"),
            {"f": first, "l": last, "p": phone},
        )


async def test_directory_lists_customers_with_their_bookings(client, engine):
    admin, artist, customer = await setup(client, engine)
    await name(engine, CUSTOMER_PHONE, "Ananya", "Rao")
    await book(client, customer, artist, slot(5, 11))
    await book(client, customer, artist, slot(6, 11))
    await sign_in(client, "+919845080002", role="customer")

    page = (await client.get(ADMIN, headers=admin)).json()

    assert [c["phone"] for c in page["items"]] == ["+919845080002", CUSTOMER_PHONE]  # newest first
    ananya = page["items"][1]
    assert (ananya["name"], ananya["bookings"], ananya["city"], ananya["status"]) == (
        "Ananya Rao",
        2,
        "Bangalore",
        "active",
    )
    assert page["items"][0]["status"] == "new"  # joined this month, no bookings yet
    assert "spend" not in str(page).lower()


async def test_search_and_segments(client, engine):
    admin, artist, customer = await setup(client, engine)
    await name(engine, CUSTOMER_PHONE, "Ananya", "Rao")
    other = await sign_in(client, "+919845080002", role="customer")
    await name(engine, "+919845080002", "Rhea")
    await book(client, customer, artist, slot(5, 11))
    await book(client, customer, artist, slot(6, 11))
    await book(client, other, artist, slot(7, 11))

    by_name = (await client.get(ADMIN, headers=admin, params={"q": "rhe"})).json()["items"]
    by_phone = (await client.get(ADMIN, headers=admin, params={"q": "80001"})).json()["items"]
    repeat = (await client.get(ADMIN, headers=admin, params={"segment": "repeat"})).json()["items"]

    assert [c["name"] for c in by_name] == ["Rhea"]
    assert [c["phone"] for c in by_phone] == [CUSTOMER_PHONE]
    assert [c["name"] for c in repeat] == ["Ananya Rao"]


async def test_summary_counts_segments_and_kpis(client, engine):
    admin, artist, customer = await setup(client, engine)
    other = await sign_in(client, "+919845080002", role="customer")
    await book(client, customer, artist, slot(5, 11))
    await book(client, customer, artist, slot(6, 11))
    await book(client, other, artist, slot(7, 11))
    async with engine.begin() as conn:
        await conn.execute(
            text("UPDATE user_account SET created_at=:t WHERE phone='+919845080002'"),
            {"t": datetime.now(UTC) - timedelta(days=90)},
        )
    await client.post(
        f"{ADMIN}/{(await client.get(ADMIN, headers=admin, params={'q': '80002'})).json()['items'][0]['id']}/block",
        headers=admin,
        json={"reason": "Abuse"},
    )

    s = (await client.get(f"{ADMIN}/summary", headers=admin)).json()

    assert s["counts"] == {"all": 2, "new": 1, "repeat": 1, "blocked": 1}
    assert s["monthly_active"] == 2
    assert s["repeat_rate"] == 0.5


async def test_detail_shows_profile_bookings_and_status(client, engine):
    admin, artist, customer = await setup(client, engine)
    await name(engine, CUSTOMER_PHONE, "Ananya", "Rao")
    b = (await book(client, customer, artist, slot(5, 11))).json()
    cid = (await client.get(ADMIN, headers=admin)).json()["items"][0]["id"]

    d = (await client.get(f"{ADMIN}/{cid}", headers=admin)).json()

    assert (d["name"], d["phone"], d["status"], d["bookings"]) == ("Ananya Rao", CUSTOMER_PHONE, "active", 1)
    assert [r["code"] for r in d["recent_bookings"]] == [b["code"]]
    assert d["recent_bookings"][0]["artist_name"] == "Ayesha Mehendi Art"
    assert d["blocked_reason"] is None


async def test_blocking_signs_the_customer_out_until_unblocked(client, engine):
    admin, _, customer = await setup(client, engine)
    cid = (await client.get(ADMIN, headers=admin)).json()["items"][0]["id"]

    blocked = await client.post(f"{ADMIN}/{cid}/block", headers=admin, json={"reason": "Repeated no-shows"})
    locked_out = await client.get("/api/v1/users/me", headers=customer)
    unblocked = await client.post(f"{ADMIN}/{cid}/unblock", headers=admin)
    back = await client.get("/api/v1/users/me", headers=customer)

    assert blocked.status_code == 200, blocked.text
    assert (blocked.json()["status"], blocked.json()["blocked_reason"]) == ("blocked", "Repeated no-shows")
    assert locked_out.status_code == 401
    assert unblocked.json()["status"] == "new"  # joined this month with no bookings yet
    assert back.status_code == 200


async def test_admins_cannot_be_blocked_and_reasons_are_required(client, engine):
    admin, _, _ = await setup(client, engine)
    await client.put("/api/v1/users/me/role", headers=admin, json={"role": "customer"})
    me = (await client.get("/api/v1/users/me", headers=admin)).json()["id"]
    cid = next(c["id"] for c in (await client.get(ADMIN, headers=admin)).json()["items"] if c["id"] != me)

    assert (await client.post(f"{ADMIN}/{me}/block", headers=admin, json={"reason": "x"})).status_code == 409
    assert (await client.post(f"{ADMIN}/{cid}/block", headers=admin, json={"reason": "  "})).status_code == 422
    assert (await client.get(f"{ADMIN}/00000000-0000-0000-0000-000000000000", headers=admin)).status_code == 404


async def test_export_is_a_csv_of_the_filtered_directory(client, engine):
    admin, artist, customer = await setup(client, engine)
    await name(engine, CUSTOMER_PHONE, "Ananya", "Rao")
    await book(client, customer, artist, slot(5, 11))

    response = await client.get(f"{ADMIN}/export", headers=admin)

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert "attachment" in response.headers["content-disposition"]
    lines = response.text.strip().splitlines()
    assert lines[0] == "name,phone,email,city,bookings,last_booking_at,joined_at,status"
    assert lines[1].startswith("Ananya Rao,+919845080001,")


async def test_customer_admin_is_admin_only(client, engine):
    _, artist, customer = await setup(client, engine)

    assert (await client.get(ADMIN, headers=customer)).status_code == 403
    assert (await client.get(ADMIN, headers=artist["headers"])).status_code == 403
