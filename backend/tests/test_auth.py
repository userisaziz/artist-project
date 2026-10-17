"""Auth flow contract: OTP request/verify, JIT registration, cooldown, rotation."""

PHONE = "+15550001111"


async def _request_and_read_code(client):
    response = await client.post("/api/v1/auth/otp/request", json={"phone": PHONE})
    assert response.status_code == 204
    from app.modules.auth.sms import ConsoleSMSProvider
    return ConsoleSMSProvider.sent[-1][1].split()[-1]


async def test_otp_verify_creates_user_jit_and_returns_tokens(client):
    code = await _request_and_read_code(client)
    response = await client.post("/api/v1/auth/otp/verify", json={"phone": PHONE, "code": code})
    assert response.status_code == 200
    body = response.json()
    assert body["user"]["phone"] == PHONE
    assert body["user"]["is_phone_verified"] is True
    assert body["access_token"] and body["refresh_token"]


async def test_second_verify_of_same_code_fails(client):
    code = await _request_and_read_code(client)
    await client.post("/api/v1/auth/otp/verify", json={"phone": PHONE, "code": code})
    response = await client.post("/api/v1/auth/otp/verify", json={"phone": PHONE, "code": code})
    assert response.status_code == 401


async def test_wrong_code_returns_401(client):
    await _request_and_read_code(client)
    response = await client.post("/api/v1/auth/otp/verify", json={"phone": PHONE, "code": "000000"})
    assert response.status_code == 401


async def test_resend_cooldown_returns_429(client):
    await _request_and_read_code(client)
    response = await client.post("/api/v1/auth/otp/request", json={"phone": PHONE})
    assert response.status_code == 429


async def test_invalid_phone_format_returns_422(client):
    response = await client.post("/api/v1/auth/otp/request", json={"phone": "15550001111"})
    assert response.status_code == 422


async def test_refresh_rotation_revokes_old_token(client):
    code = await _request_and_read_code(client)
    verify = (await client.post("/api/v1/auth/otp/verify", json={"phone": PHONE, "code": code})).json()
    refreshed = await client.post("/api/v1/auth/refresh", json={"refresh_token": verify["refresh_token"]})
    assert refreshed.status_code == 200
    reuse = await client.post("/api/v1/auth/refresh", json={"refresh_token": verify["refresh_token"]})
    assert reuse.status_code == 401


async def test_expired_code_is_rejected(client, engine):
    code = await _request_and_read_code(client)
    from sqlalchemy import text
    async with engine.begin() as conn:
        await conn.execute(text("UPDATE otp_codes SET expires_at = now() - interval '1 minute'"))
    response = await client.post("/api/v1/auth/otp/verify", json={"phone": PHONE, "code": code})
    assert response.status_code == 401
