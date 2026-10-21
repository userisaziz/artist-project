"""Saved addresses: any signed-in user keeps up to 10 labelled addresses, most recently used first. Saving the
same text again (case and spacing aside) returns the existing one with the new label; other people's rows are
never visible; deleting the account removes them."""

import uuid

from sqlalchemy import text

from tests.support.auth import CUSTOMER_PHONE, sign_in

ADDRESSES = "/api/v1/users/me/addresses"
OTHER_PHONE = "+919845080002"


async def add(client, headers, label: str = "Home", address: str = "12 Residency Rd, Bangalore 560025"):
    return await client.post(ADDRESSES, headers=headers, json={"label": label, "address": address})


async def listed(client, headers) -> list[dict]:
    response = await client.get(ADDRESSES, headers=headers)
    assert response.status_code == 200, response.text
    return response.json()


async def test_add_and_list_with_the_used_one_first(client):
    headers = await sign_in(client, CUSTOMER_PHONE, role="customer")
    created = await add(client, headers, "  Home  ", "  12 Residency Rd, Bangalore 560025  ")
    assert created.status_code == 201, created.text
    home = body = created.json()
    assert body["label"] == "Home"
    assert body["address"] == "12 Residency Rd, Bangalore 560025"
    assert body["last_used_at"] is None
    assert set(body) == {"id", "label", "address", "created_at", "last_used_at"}
    office = (await add(client, headers, "Office", "4 MG Road, Bangalore 560001")).json()
    gym = (await add(client, headers, "Gym", "7 Church St, Bangalore 560001")).json()

    assert [a["id"] for a in await listed(client, headers)] == [gym["id"], office["id"], home["id"]]

    used = await client.post(f"{ADDRESSES}/{home['id']}/used", headers=headers)
    assert used.status_code == 204, used.text
    rows = await listed(client, headers)
    assert [a["id"] for a in rows] == [home["id"], gym["id"], office["id"]]
    assert rows[0]["last_used_at"] is not None


async def test_saving_the_same_text_returns_the_existing_one_with_the_new_label(client):
    headers = await sign_in(client, CUSTOMER_PHONE, role="customer")
    first = (await add(client, headers, "Home", "12 Residency Rd, Bangalore 560025")).json()

    again = await add(client, headers, "Mum's", "12  residency rd,   BANGALORE 560025")
    assert again.status_code == 200, again.text
    assert again.json()["id"] == first["id"]
    assert again.json()["label"] == "Mum's"
    rows = await listed(client, headers)
    assert len(rows) == 1
    assert rows[0]["label"] == "Mum's"
    assert rows[0]["address"] == "12 Residency Rd, Bangalore 560025"


async def test_at_most_ten_addresses(client):
    headers = await sign_in(client, CUSTOMER_PHONE, role="customer")
    for n in range(10):
        assert (await add(client, headers, f"Place {n}", f"{n} Long Street, Pune")).status_code == 201

    over = await add(client, headers, "One more", "99 Long Street, Pune")
    assert over.status_code == 409, over.text
    assert over.json()["message"] == "You can save up to 10 addresses"
    # A duplicate is not a new row, so it still works at the limit.
    assert (await add(client, headers, "Renamed", "0 long street, pune")).status_code == 200
    assert len(await listed(client, headers)) == 10


async def test_invalid_bodies_are_rejected(client):
    headers = await sign_in(client, CUSTOMER_PHONE, role="customer")
    for label, address in [
        ("   ", "12 Residency Rd"),
        ("Home", "  ab  "),
        ("Home", "x" * 301),
        ("x" * 41, "12 Residency Rd"),
    ]:
        response = await add(client, headers, label, address)
        assert response.status_code == 422, (label, address, response.text)
    saved = (await add(client, headers)).json()
    empty = await client.patch(f"{ADDRESSES}/{saved['id']}", headers=headers, json={})
    assert empty.status_code == 422, empty.text
    assert await listed(client, headers) == [saved]


async def test_patch_changes_label_or_address(client):
    headers = await sign_in(client, CUSTOMER_PHONE, role="customer")
    saved = (await add(client, headers)).json()
    url = f"{ADDRESSES}/{saved['id']}"

    relabelled = await client.patch(url, headers=headers, json={"label": " Flat "})
    assert relabelled.status_code == 200, relabelled.text
    assert relabelled.json()["label"] == "Flat"
    assert relabelled.json()["address"] == saved["address"]

    moved = await client.patch(url, headers=headers, json={"address": " 3 Brigade Rd, Bangalore "})
    assert moved.status_code == 200, moved.text
    assert moved.json() | {"address": None} == relabelled.json() | {"address": None}
    assert moved.json()["address"] == "3 Brigade Rd, Bangalore"
    assert (await client.patch(url, headers=headers, json={"label": ""})).status_code == 422

    other = (await add(client, headers, "Office", "4 MG Road, Bangalore 560001")).json()
    clash = await client.patch(url, headers=headers, json={"address": "4 mg road,  bangalore 560001"})
    assert clash.status_code == 409, clash.text
    assert clash.json()["message"] == "You already saved this address"
    assert len(await listed(client, headers)) == 2
    assert other["id"] != saved["id"]


async def test_delete_is_idempotent(client):
    headers = await sign_in(client, CUSTOMER_PHONE, role="customer")
    saved = (await add(client, headers)).json()
    url = f"{ADDRESSES}/{saved['id']}"

    assert (await client.delete(url, headers=headers)).status_code == 204
    assert (await client.delete(url, headers=headers)).status_code == 204
    assert (await client.delete(f"{ADDRESSES}/{uuid.uuid4()}", headers=headers)).status_code == 204
    assert await listed(client, headers) == []


async def test_other_peoples_addresses_are_out_of_reach(client):
    owner = await sign_in(client, CUSTOMER_PHONE, role="customer")
    other = await sign_in(client, OTHER_PHONE, role="artist")
    saved = (await add(client, owner)).json()
    url = f"{ADDRESSES}/{saved['id']}"

    assert (await client.patch(url, headers=other, json={"label": "Mine"})).status_code == 404
    assert (await client.post(f"{url}/used", headers=other)).status_code == 404
    assert (await client.post(f"{ADDRESSES}/{uuid.uuid4()}/used", headers=owner)).status_code == 404
    assert (await client.delete(url, headers=other)).status_code == 204
    assert await listed(client, other) == []
    assert await listed(client, owner) == [saved]


async def test_signed_out_requests_are_refused(client):
    some_id = uuid.uuid4()
    for method, url in [
        ("GET", ADDRESSES),
        ("POST", ADDRESSES),
        ("PATCH", f"{ADDRESSES}/{some_id}"),
        ("DELETE", f"{ADDRESSES}/{some_id}"),
        ("POST", f"{ADDRESSES}/{some_id}/used"),
    ]:
        response = await client.request(method, url, json={"label": "Home", "address": "12 Residency Rd"})
        assert response.status_code == 401, (method, url, response.text)


async def test_deleting_the_account_removes_the_addresses(client, engine):
    headers = await sign_in(client, CUSTOMER_PHONE, role="customer")
    await add(client, headers)
    await add(client, headers, "Office", "4 MG Road, Bangalore 560001")

    assert (await client.delete("/api/v1/users/me", headers=headers)).status_code == 204
    async with engine.connect() as conn:
        left = await conn.scalar(text("SELECT count(*) FROM user_address"))
    assert left == 0
