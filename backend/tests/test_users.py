"""Onboarding contract: sign-up details, then Choose role — which also switches sides later (multi-role)."""

from datetime import UTC, datetime

from tests.support.auth import PHONE, request_and_read_code


async def _login(client) -> dict:
    code = await request_and_read_code(client)
    body = (await client.post("/api/v1/auth/otp/verify", json={"phone": PHONE, "code": code})).json()
    return {"Authorization": f"Bearer {body['access_token']}"}


async def test_new_user_is_not_onboarded(client):
    headers = await _login(client)
    me = (await client.get("/api/v1/users/me", headers=headers)).json()
    assert me["is_onboarded"] is False
    assert me["roles"] == []
    assert me["active_role"] is None
    assert me["date_of_birth"] is None  # nothing asked yet


async def test_update_details_saves_name(client):
    headers = await _login(client)
    response = await client.patch(
        "/api/v1/users/me",
        headers=headers,
        json={
            "first_name": "Asha",
            "last_name": "Rao",
            "date_of_birth": "1995-04-12",
            "email": "asha@example.com",
            "whatsapp_booking_updates": False,
        },
    )
    assert response.status_code == 200
    assert response.json()["first_name"] == "Asha"
    assert response.json()["date_of_birth"] == "1995-04-12"
    assert response.json()["whatsapp_booking_updates"] is False
    assert response.json()["is_onboarded"] is False


async def test_details_need_a_date_of_birth(client):
    headers = await _login(client)
    response = await client.patch("/api/v1/users/me", headers=headers, json={"first_name": "Asha"})
    assert response.status_code == 422
    assert response.json()["code"] == "validation_error"


async def test_details_reject_a_future_date(client):
    headers = await _login(client)
    response = await client.patch(
        "/api/v1/users/me", headers=headers, json={"first_name": "Asha", "date_of_birth": "2030-01-01"}
    )
    assert response.status_code == 422


async def test_details_require_an_adult(client, travel):
    """The 18 line is the birthday itself; the day before it is still a minor."""
    travel(datetime(2026, 10, 31, 12, tzinfo=UTC))
    headers = await _login(client)
    base = {"first_name": "Asha"}

    minor = await client.patch("/api/v1/users/me", headers=headers, json=base | {"date_of_birth": "2008-11-01"})
    assert minor.status_code == 422
    assert "18" in minor.json()["message"]
    assert (await client.get("/api/v1/users/me", headers=headers)).json()["date_of_birth"] is None  # nothing saved

    adult = await client.patch("/api/v1/users/me", headers=headers, json=base | {"date_of_birth": "2008-10-31"})
    assert adult.status_code == 200
    assert adult.json()["date_of_birth"] == "2008-10-31"


async def test_choose_role_onboards_and_switching_adds_the_other_side(client):
    headers = await _login(client)
    response = await client.put("/api/v1/users/me/role", headers=headers, json={"role": "artist"})
    assert response.status_code == 200
    assert response.json() | {"id": None} == response.json() | {
        "id": None,
        "roles": ["artist"],
        "active_role": "artist",
        "is_onboarded": True,
    }

    switched = (await client.put("/api/v1/users/me/role", headers=headers, json={"role": "customer"})).json()
    assert switched["roles"] == ["customer", "artist"]  # artist is kept: one account, both sides
    assert switched["active_role"] == "customer"

    back = (await client.put("/api/v1/users/me/role", headers=headers, json={"role": "artist"})).json()
    assert back["roles"] == ["customer", "artist"]
    assert back["active_role"] == "artist"


async def test_admin_keeps_admin_when_picking_app_roles(client, engine):
    from sqlalchemy import text

    headers = await _login(client)
    async with engine.begin() as conn:
        await conn.execute(text("INSERT INTO user_role_grant (user_id, role) SELECT id, 'admin' FROM user_account"))
    me = (await client.get("/api/v1/users/me", headers=headers)).json()
    assert me["roles"] == ["admin"]
    assert me["is_onboarded"] is False  # admin alone doesn't pick a mobile side
    me = (await client.put("/api/v1/users/me/role", headers=headers, json={"role": "customer"})).json()
    me = (await client.put("/api/v1/users/me/role", headers=headers, json={"role": "artist"})).json()
    assert me["roles"] == ["customer", "artist", "admin"]
    assert me["active_role"] == "artist"
    assert (await client.get("/api/v1/admin/categories", headers=headers)).status_code == 200


async def test_admin_role_cannot_be_chosen(client):
    headers = await _login(client)
    response = await client.put("/api/v1/users/me/role", headers=headers, json={"role": "admin"})
    assert response.status_code == 422


async def test_users_me_requires_auth(client):
    response = await client.get("/api/v1/users/me")
    assert response.status_code in (401, 403)
