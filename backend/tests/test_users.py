"""Onboarding contract: sign-up details, then a one-time role choice that flips is_onboarded."""

from tests.test_auth import _request_and_read_code, PHONE


async def _login(client) -> dict:
    code = await _request_and_read_code(client)
    body = (await client.post("/api/v1/auth/otp/verify", json={"phone": PHONE, "code": code})).json()
    return {"Authorization": f"Bearer {body['access_token']}"}


async def test_new_user_is_not_onboarded(client):
    headers = await _login(client)
    me = (await client.get("/api/v1/users/me", headers=headers)).json()
    assert me["is_onboarded"] is False
    assert me["role"] == "customer"


async def test_update_details_saves_name(client):
    headers = await _login(client)
    response = await client.patch("/api/v1/users/me", headers=headers, json={
        "first_name": "Asha", "last_name": "Rao", "email": "asha@example.com", "whatsapp_booking_updates": False,
    })
    assert response.status_code == 200
    assert response.json()["first_name"] == "Asha"
    assert response.json()["whatsapp_booking_updates"] is False
    assert response.json()["is_onboarded"] is False


async def test_choose_artist_onboards_once(client):
    headers = await _login(client)
    response = await client.put("/api/v1/users/me/role", headers=headers, json={"role": "artist"})
    assert response.status_code == 200
    assert response.json()["role"] == "artist"
    assert response.json()["is_onboarded"] is True

    again = await client.put("/api/v1/users/me/role", headers=headers, json={"role": "customer"})
    assert again.status_code == 409


async def test_admin_role_cannot_be_chosen(client):
    headers = await _login(client)
    response = await client.put("/api/v1/users/me/role", headers=headers, json={"role": "admin"})
    assert response.status_code == 422


async def test_users_me_requires_auth(client):
    response = await client.get("/api/v1/users/me")
    assert response.status_code in (401, 403)
