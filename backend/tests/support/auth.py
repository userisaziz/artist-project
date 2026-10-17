"""OTP sign-in and role helpers shared by every domain's tests."""

from sqlalchemy import text

from app.auth.sms import ConsoleSMSProvider

PHONE = "+15550001111"  # the generic number for auth/users tests
CUSTOMER_PHONE = "+919845080001"
ADMIN_PHONE = "+919845000001"


async def sign_in(client, phone: str, role: str | None = "artist", engine=None) -> dict:
    """Phone + OTP, then optionally pick a role (artist/customer) or force admin straight in the DB."""
    await client.post("/api/v1/auth/otp/request", json={"phone": phone})
    code = ConsoleSMSProvider.sent[-1][1].split()[-1]
    body = (await client.post("/api/v1/auth/otp/verify", json={"phone": phone, "code": code})).json()
    headers = {"Authorization": f"Bearer {body['access_token']}"}
    if role in ("artist", "customer"):
        await client.put("/api/v1/users/me/role", headers=headers, json={"role": role})
    elif role == "admin":
        async with engine.begin() as conn:
            await conn.execute(
                text("INSERT INTO user_role_grant (user_id, role) SELECT id, 'admin' FROM user_account WHERE phone=:p"),
                {"p": phone},
            )
    return headers


async def request_and_read_code(client) -> str:
    response = await client.post("/api/v1/auth/otp/request", json={"phone": PHONE})
    assert response.status_code == 204, response.text
    return ConsoleSMSProvider.sent[-1][1].split()[-1]


async def admin_headers(client, engine) -> dict:
    return await sign_in(client, ADMIN_PHONE, role="admin", engine=engine)
