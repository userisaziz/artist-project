"""Mandatory profile requirements: admins switch one on with a grace period; approved artists missing it are warned,
then put on hold (hidden, no new bookings or enquiries) once the grace period ends, until they complete it."""

from datetime import timedelta

import pytest_asyncio
from sqlalchemy import text

from app.shared.clock import SYSTEM_CLOCK, FixedClock
from scripts import maintenance
from tests.support.artist import approved_artist
from tests.support.auth import CUSTOMER_PHONE, admin_headers, sign_in
from tests.support.booking import book
from tests.support.catalog import area_id, seed_categories

SETTINGS = "/api/v1/admin/settings/requirements"
ARTIST_PHONE = "+919845075001"


@pytest_asyncio.fixture(autouse=True)
async def categories_seeded(engine):
    await seed_categories(engine)


async def sql(engine, statement: str, **params) -> None:
    async with engine.begin() as conn:
        await conn.execute(text(statement), params)


async def without_location(client, engine, admin: dict) -> dict:
    """An approved artist from before the Location step: no area or pincode on file."""
    artist = await approved_artist(client, engine, ARTIST_PHONE, admin)
    await sql(
        engine,
        "update artist_profile set area_id = null, locality = null, pincode = null where id = :id",
        id=artist["id"],
    )
    return artist


async def make_mandatory(client, admin: dict, grace_days: int = 7) -> dict:
    response = await client.put(
        f"{SETTINGS}/location", headers=admin, json={"mandatory": True, "grace_days": grace_days}
    )
    assert response.status_code == 200, response.text
    return response.json()


async def overdue(engine) -> None:
    """Moves the requirement's start back past its grace period."""
    await sql(
        engine, "update requirement_setting set effective_from = now() - interval '30 days' where key = 'location'"
    )


async def mine(client, artist: dict) -> dict:
    response = await client.get("/api/v1/artists/me/requirements", headers=artist["headers"])
    assert response.status_code == 200, response.text
    return response.json()


async def listed(client) -> list[str]:
    return [a["id"] for a in (await client.get("/api/v1/artists")).json()["items"]]


async def test_admins_read_and_switch_on_a_requirement(client, engine):
    admin = await admin_headers(client, engine)

    rows = (await client.get(SETTINGS, headers=admin)).json()
    assert [(r["key"], r["mandatory"], r["grace_days"], r["effective_from"]) for r in rows] == [
        ("location", False, 7, None),
        ("experience", False, 7, None),
        ("languages", False, 7, None),
    ]
    assert rows[0]["title"]

    on = await make_mandatory(client, admin, grace_days=14)
    assert (on["mandatory"], on["grace_days"]) == (True, 14) and on["effective_from"] is not None
    again = await client.put(f"{SETTINGS}/location", headers=admin, json={"mandatory": True, "grace_days": 3})
    assert again.json()["effective_from"] == on["effective_from"]  # changing the grace keeps the start date

    off = await client.put(f"{SETTINGS}/location", headers=admin, json={"mandatory": False, "grace_days": 3})
    assert (off.json()["mandatory"], off.json()["effective_from"]) == (False, None)

    unknown = await client.put(f"{SETTINGS}/nope", headers=admin, json={"mandatory": True, "grace_days": 7})
    assert unknown.status_code == 404
    for grace in (-1, 91):
        bad = await client.put(f"{SETTINGS}/location", headers=admin, json={"mandatory": True, "grace_days": grace})
        assert bad.status_code == 422
    artist = await sign_in(client, ARTIST_PHONE)
    assert (await client.get(SETTINGS, headers=artist)).status_code == 403


async def test_a_missing_requirement_warns_then_holds_until_completed(client, engine):
    admin = await admin_headers(client, engine)
    artist = await without_location(client, engine, admin)
    assert await mine(client, artist) == {"on_hold": False, "items": []}  # not mandatory yet: nothing to nag about

    await make_mandatory(client, admin)
    me = await mine(client, artist)
    [req] = me["items"]
    assert (req["key"], req["overdue"], me["on_hold"]) == ("location", False, False)
    assert req["due_at"] and req["action"] == "/artist/location"
    assert artist["id"] in await listed(client)  # still visible during the grace period

    await overdue(engine)
    me = await mine(client, artist)
    assert (me["items"][0]["overdue"], me["on_hold"]) == (True, True)
    profile = (await client.get("/api/v1/artists/me", headers=artist["headers"])).json()
    assert profile["status"] == "approved"  # on hold is not a status: an admin suspension is never overwritten
    assert artist["id"] not in await listed(client)
    assert (await client.get(f"/api/v1/artists/{artist['id']}")).status_code == 404
    customer = await sign_in(client, CUSTOMER_PHONE, role="customer")
    refused = await book(client, customer, artist)
    assert (refused.status_code, refused.json()["code"]) == (409, "conflict")
    assert (await client.get("/api/v1/artists/me/bookings", headers=artist["headers"])).status_code == 200

    fixed = await client.put(
        "/api/v1/artists/me/location",
        headers=artist["headers"],
        json={"area_id": await area_id(client, "Bangalore", "Koramangala"), "pincode": "560095"},
    )
    assert fixed.status_code == 200, fixed.text
    assert fixed.json()["status"] == "approved"  # fixing it needs no new review
    assert await mine(client, artist) == {"on_hold": False, "items": []}
    assert artist["id"] in await listed(client)
    assert (await book(client, customer, artist)).status_code == 201


async def test_admins_find_held_artists_and_remind_them(client, engine):
    admin = await admin_headers(client, engine)
    artist = await without_location(client, engine, admin)
    complete = await approved_artist(client, engine, "+919845075002", admin, name="Complete")
    await make_mandatory(client, admin)

    remind = await client.post(f"/api/v1/admin/requirements/{artist['id']}/remind", headers=admin)
    assert remind.status_code == 204
    inbox = (await client.get("/api/v1/notifications", headers=artist["headers"])).json()["items"]
    assert inbox[0]["kind"] == "requirement_reminder" and inbox[0]["link"] == "/artist/location"
    nothing = await client.post(f"/api/v1/admin/requirements/{complete['id']}/remind", headers=admin)
    assert nothing.status_code == 409

    view = (await client.get(f"/api/v1/admin/requirements/{artist['id']}", headers=admin)).json()
    assert ([i["key"] for i in view["items"]], view["on_hold"]) == (["location"], False)

    await overdue(engine)
    held = (await client.get("/api/v1/admin/artists/directory?status=on_hold", headers=admin)).json()["items"]
    summary = (await client.get("/api/v1/admin/artists/directory/summary", headers=admin)).json()
    assert summary["counts"]["on_hold"] == 1
    assert [(r["id"], r["missing_requirements"]) for r in held] == [(artist["id"], ["location"])]
    every = (await client.get("/api/v1/admin/artists/directory", headers=admin)).json()["items"]
    assert {r["id"]: r["missing_requirements"] for r in every}[complete["id"]] == []


async def test_notices_go_out_once_per_stage(client, engine):
    admin = await admin_headers(client, engine)
    artist = await without_location(client, engine, admin)
    await make_mandatory(client, admin)
    now = FixedClock(SYSTEM_CLOCK.now())

    assert await maintenance.send_requirement_notices(now) == {"requirement_due": 1, "requirement_on_hold": 0}
    assert await maintenance.send_requirement_notices(now) == {"requirement_due": 0, "requirement_on_hold": 0}
    await overdue(engine)
    later = FixedClock(SYSTEM_CLOCK.now() + timedelta(seconds=1))
    assert await maintenance.send_requirement_notices(later) == {"requirement_due": 0, "requirement_on_hold": 1}
    assert await maintenance.send_requirement_notices(later) == {"requirement_due": 0, "requirement_on_hold": 0}

    inbox = (await client.get("/api/v1/notifications", headers=artist["headers"])).json()["items"]
    kinds = [n["kind"] for n in inbox]
    assert kinds.count("requirement_due") == 1 and kinds.count("requirement_on_hold") == 1


async def test_experience_and_languages_can_be_required_and_are_fixed_from_details(client, engine):
    admin = await admin_headers(client, engine)
    artist = await approved_artist(client, engine, ARTIST_PHONE, admin)  # no experience or languages given
    for key in ("experience", "languages"):
        on = await client.put(f"{SETTINGS}/{key}", headers=admin, json={"mandatory": True, "grace_days": 0})
        assert on.status_code == 200, on.text

    me = await mine(client, artist)
    assert ([i["key"] for i in me["items"]], me["on_hold"]) == (["experience", "languages"], True)
    assert {i["action"] for i in me["items"]} == {"/artist/details"}
    assert artist["id"] not in await listed(client)

    details = {"experience_years": 6, "languages": ["Hindi"]}
    fixed = await client.patch("/api/v1/artists/me/details", headers=artist["headers"], json=details)
    assert fixed.status_code == 200, fixed.text
    assert await mine(client, artist) == {"on_hold": False, "items": []}
    assert artist["id"] in await listed(client)
