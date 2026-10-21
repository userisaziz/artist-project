"""Admin settings, phase 1: the booking rules (read-only, set in server config), the live cities with artist
counts, and team access (who is an admin; add by phone, remove, never yourself or the last admin)."""

import pytest_asyncio

from tests.support.auth import sign_in
from tests.support.booking import setup
from tests.support.catalog import seed_categories

SETTINGS = "/api/v1/admin/settings"


@pytest_asyncio.fixture(autouse=True)
async def categories_seeded(engine):
    await seed_categories(engine)


async def test_policies_show_the_booking_rules_without_fees(client, engine):
    admin, _, _ = await setup(client, engine)

    policies = (await client.get(f"{SETTINGS}/policies", headers=admin)).json()

    keys = {p["key"]: p for p in policies}
    assert keys["booking_accept_hours"]["value"] == "3 hours to accept a request"
    assert keys["slot_hours"]["value"] == "Hourly, within each artist's working hours (default 8:00 to 20:00 IST)"
    assert keys["payments"]["value"] == "Customers pay the artist directly; no in-app payments"
    assert all(p["editable"] is False for p in policies)
    assert "commission" not in keys


async def test_cities_list_artists_per_city(client, engine):
    admin, _, _ = await setup(client, engine)

    cities = {c["name"]: c for c in (await client.get(f"{SETTINGS}/cities", headers=admin)).json()}

    assert cities["Bangalore"]["artists"] == 1
    assert cities["Mumbai"]["artists"] == 0


async def test_team_add_by_phone_and_remove(client, engine):
    admin, _, _ = await setup(client, engine)
    await sign_in(client, "+919845070001", role="customer")

    added = await client.post(f"{SETTINGS}/team", headers=admin, json={"phone": "+919845070001"})
    team = (await client.get(f"{SETTINGS}/team", headers=admin)).json()
    again = await client.post(f"{SETTINGS}/team", headers=admin, json={"phone": "+919845070001"})
    removed = await client.delete(f"{SETTINGS}/team/{added.json()['id']}", headers=admin)

    assert added.status_code == 201, added.text
    assert {m["phone"] for m in team} == {"+919845000001", "+919845070001"}
    assert [m["is_me"] for m in team if m["phone"] == "+919845000001"] == [True]
    assert again.status_code == 409
    assert removed.status_code == 204
    assert len((await client.get(f"{SETTINGS}/team", headers=admin)).json()) == 1


async def test_team_guards(client, engine):
    admin, _, _ = await setup(client, engine)
    me = next(m for m in (await client.get(f"{SETTINGS}/team", headers=admin)).json() if m["is_me"])

    unknown = await client.post(f"{SETTINGS}/team", headers=admin, json={"phone": "+919800000000"})
    myself = await client.delete(f"{SETTINGS}/team/{me['id']}", headers=admin)
    bad = await client.post(f"{SETTINGS}/team", headers=admin, json={"phone": "12345"})

    assert unknown.status_code == 404
    assert myself.status_code == 409
    assert bad.status_code == 422


async def test_settings_are_admin_only(client, engine):
    _, artist, customer = await setup(client, engine)

    assert (await client.get(f"{SETTINGS}/team", headers=customer)).status_code == 403
    assert (
        await client.post(f"{SETTINGS}/team", headers=artist["headers"], json={"phone": "+919845070001"})
    ).status_code == 403
