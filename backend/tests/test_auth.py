"""Auth flow contract: OTP request/verify, JIT registration, cooldown, rotation, limits, token families."""

import asyncio
import logging

from app.auth.config import AuthSettings, get_auth_settings
from app.auth.dependencies import otp_request_per_ip, otp_request_per_phone
from app.auth.sms import SMSProvider, get_sms_provider
from app.core.exceptions import ServiceUnavailableError
from app.core.rate_limit import Limit
from tests.support.auth import PHONE, request_and_read_code


async def test_otp_verify_creates_user_jit_and_returns_tokens(client):
    code = await request_and_read_code(client)
    response = await client.post("/api/v1/auth/otp/verify", json={"phone": PHONE, "code": code})
    assert response.status_code == 200
    body = response.json()
    assert body["user"]["phone"] == PHONE
    assert body["user"]["is_phone_verified"] is True
    assert body["access_token"] and body["refresh_token"]


async def test_second_verify_of_same_code_fails(client):
    code = await request_and_read_code(client)
    await client.post("/api/v1/auth/otp/verify", json={"phone": PHONE, "code": code})
    response = await client.post("/api/v1/auth/otp/verify", json={"phone": PHONE, "code": code})
    assert response.status_code == 401


async def test_wrong_code_returns_401(client):
    await request_and_read_code(client)
    response = await client.post("/api/v1/auth/otp/verify", json={"phone": PHONE, "code": "000000"})
    assert response.status_code == 401


async def test_repeated_wrong_codes_lock_the_otp_out(client):
    """Failed attempts must persist despite the error rollback, or the lockout never fires."""
    from app.auth.config import get_auth_settings

    code = await request_and_read_code(client)
    for _ in range(get_auth_settings().otp_max_attempts):
        response = await client.post("/api/v1/auth/otp/verify", json={"phone": PHONE, "code": "000000"})
        assert response.status_code == 401
    response = await client.post("/api/v1/auth/otp/verify", json={"phone": PHONE, "code": code})
    assert response.status_code == 401  # right code, but the code is now locked out


async def test_resend_cooldown_returns_429(client):
    await request_and_read_code(client)
    response = await client.post("/api/v1/auth/otp/request", json={"phone": PHONE})
    assert response.status_code == 429


async def test_invalid_phone_format_returns_422(client):
    response = await client.post("/api/v1/auth/otp/request", json={"phone": "15550001111"})
    assert response.status_code == 422


async def test_refresh_rotation_revokes_old_token(client):
    code = await request_and_read_code(client)
    verify = (await client.post("/api/v1/auth/otp/verify", json={"phone": PHONE, "code": code})).json()
    refreshed = await client.post("/api/v1/auth/refresh", json={"refresh_token": verify["refresh_token"]})
    assert refreshed.status_code == 200
    reuse = await client.post("/api/v1/auth/refresh", json={"refresh_token": verify["refresh_token"]})
    assert reuse.status_code == 401


async def test_expired_code_is_rejected(client, engine):
    code = await request_and_read_code(client)
    from sqlalchemy import text

    async with engine.begin() as conn:
        await conn.execute(text("UPDATE auth_otp_code SET expires_at = now() - interval '1 minute'"))
    response = await client.post("/api/v1/auth/otp/verify", json={"phone": PHONE, "code": code})
    assert response.status_code == 401


# --- hardening: limits, races, delivery failures, token families --------------------------------


async def _sign_in(client) -> dict:
    code = await request_and_read_code(client)
    return (await client.post("/api/v1/auth/otp/verify", json={"phone": PHONE, "code": code})).json()


async def test_otp_requests_are_limited_per_ip_with_retry_after(client, override):
    override(otp_request_per_ip, lambda: Limit(hits=2, window_seconds=600))
    for phone in ("+15550002001", "+15550002002"):
        assert (await client.post("/api/v1/auth/otp/request", json={"phone": phone})).status_code == 204
    third = await client.post("/api/v1/auth/otp/request", json={"phone": "+15550002003"})
    assert third.status_code == 429
    assert third.json()["code"] == "rate_limited"
    assert 0 < int(third.headers["retry-after"]) <= 600


async def test_otp_requests_are_limited_per_phone(client, override):
    override(get_auth_settings, lambda: AuthSettings(sms_provider="console", otp_resend_cooldown_seconds=0))
    override(otp_request_per_phone, lambda: Limit(hits=1, window_seconds=3600))
    assert (await client.post("/api/v1/auth/otp/request", json={"phone": PHONE})).status_code == 204
    assert (await client.post("/api/v1/auth/otp/request", json={"phone": PHONE})).status_code == 429


async def test_simultaneous_requests_for_one_phone_send_one_code(client):
    """The cooldown check runs under a per-phone lock, so two racing requests can't both pass it."""
    from app.auth.sms import ConsoleSMSProvider

    responses = await asyncio.gather(
        *(client.post("/api/v1/auth/otp/request", json={"phone": PHONE}) for _ in range(2))
    )
    assert sorted(r.status_code for r in responses) == [204, 429]
    assert len(ConsoleSMSProvider.sent) == 1


async def test_failed_sms_is_a_503_and_does_not_start_the_cooldown(client, override):
    class DownSMS(SMSProvider):
        async def send_otp(self, phone: str, code: str) -> None:
            raise ServiceUnavailableError("We couldn't send the code right now.")

    override(get_sms_provider, DownSMS)
    failed = await client.post("/api/v1/auth/otp/request", json={"phone": PHONE})
    assert (failed.status_code, failed.json()["code"]) == (503, "service_unavailable")

    override(get_sms_provider, get_sms_provider)  # delivery is back
    assert (await client.post("/api/v1/auth/otp/request", json={"phone": PHONE})).status_code == 204


async def test_replaying_a_rotated_refresh_token_signs_out_the_whole_session(client):
    first = (await _sign_in(client))["refresh_token"]
    second = (await client.post("/api/v1/auth/refresh", json={"refresh_token": first})).json()["refresh_token"]
    assert (await client.post("/api/v1/auth/refresh", json={"refresh_token": first})).status_code == 401
    # The legitimate holder of the newer token is signed out too: the family is burned.
    assert (await client.post("/api/v1/auth/refresh", json={"refresh_token": second})).status_code == 401


async def test_logout_revokes_the_session_and_is_idempotent(client):
    token = (await _sign_in(client))["refresh_token"]
    assert (await client.post("/api/v1/auth/logout", json={"refresh_token": token})).status_code == 204
    assert (await client.post("/api/v1/auth/refresh", json={"refresh_token": token})).status_code == 401
    assert (await client.post("/api/v1/auth/logout", json={"refresh_token": token})).status_code == 204
    assert (await client.post("/api/v1/auth/logout", json={"refresh_token": "garbage"})).status_code == 204


async def test_sign_ins_and_failures_are_audited_with_masked_phones(client, caplog):
    caplog.set_level(logging.INFO, logger="art_circle.audit")
    code = await request_and_read_code(client)
    await client.post("/api/v1/auth/otp/verify", json={"phone": PHONE, "code": "000000"})
    await client.post("/api/v1/auth/otp/verify", json={"phone": PHONE, "code": code})
    audit = [r for r in caplog.records if r.name == "art_circle.audit"]
    assert [(r.event, getattr(r, "reason", None)) for r in audit] == [
        ("auth.otp_requested", None),
        ("auth.otp_rejected", "wrong_code"),
        ("auth.signed_in", None),
    ]
    assert all(PHONE not in str(r.__dict__) for r in audit)
    assert audit[0].phone == "+15*****1111"
