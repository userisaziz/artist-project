"""Auth flow contract: OTP request/verify, JIT registration, cooldown, rotation, limits, token families."""

import asyncio
import logging

import pytest

from app.auth.config import AuthSettings, get_auth_settings
from app.auth.dependencies import otp_request_per_ip, otp_request_per_phone
from app.auth.sms import SMSProvider, get_sms_provider
from app.core.config import get_settings
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


async def test_simultaneous_refreshes_with_one_token_rotate_it_once(client):
    """Row-locked rotation: the second request sees the token already rotated (reuse), never a forked session."""
    token = (await _sign_in(client))["refresh_token"]
    responses = await asyncio.gather(
        *(client.post("/api/v1/auth/refresh", json={"refresh_token": token}) for _ in range(2))
    )
    assert sorted(r.status_code for r in responses) == [200, 401]


async def test_simultaneous_verifies_of_one_code_sign_in_once(client):
    code = await request_and_read_code(client)
    responses = await asyncio.gather(
        *(client.post("/api/v1/auth/otp/verify", json={"phone": PHONE, "code": code}) for _ in range(2))
    )
    assert sorted(r.status_code for r in responses) == [200, 401]


# --- httpOnly refresh cookie transport (admin web) ------------------------------------------------

COOKIE_MODE = {"X-Session-Transport": "cookie"}
SESSION_COOKIE_MODE = {"X-Session-Transport": "cookie-session"}
ADMIN_ORIGIN = "http://localhost:5173"


@pytest.fixture(autouse=True)
def empty_cookie_jar(client):
    """The client is session-scoped: never let one test's refresh cookie reach the next."""
    client.cookies.clear()
    yield
    client.cookies.clear()


async def _sign_in_with(client, headers: dict):
    code = await request_and_read_code(client)
    return await client.post("/api/v1/auth/otp/verify", json={"phone": PHONE, "code": code}, headers=headers)


def _cookie_attrs(response) -> dict[str, str]:
    """`Set-Cookie: ac_refresh=...; HttpOnly; ...` as {lower-cased attribute: value}."""
    header = response.headers["set-cookie"]
    parts = [p.strip() for p in header.split(";")]
    name, _, value = parts[0].partition("=")
    attrs = {"name": name, "value": value}
    for part in parts[1:]:
        key, _, val = part.partition("=")
        attrs[key.lower()] = val
    return attrs


async def test_verify_in_cookie_mode_sets_an_httponly_cookie_and_hides_the_token(client):
    response = await _sign_in_with(client, COOKIE_MODE)
    assert response.status_code == 200
    assert response.json()["refresh_token"] is None
    assert response.json()["access_token"]
    cookie = _cookie_attrs(response)
    assert cookie["name"] == "ac_refresh" and cookie["value"]
    assert "httponly" in cookie
    assert cookie["samesite"].lower() == "strict"
    assert cookie["path"] == "/api/v1/auth"
    assert int(cookie["max-age"]) == get_settings().refresh_token_ttl_days * 86400
    assert "secure" not in cookie  # test environment: plain http


async def test_cookie_is_secure_outside_local_and_test(client, override):
    override(get_settings, lambda: get_settings().model_copy(update={"environment": "staging"}))
    response = await _sign_in_with(client, COOKIE_MODE)
    assert "secure" in _cookie_attrs(response)


async def test_cookie_session_mode_sets_a_session_cookie(client):
    response = await _sign_in_with(client, SESSION_COOKIE_MODE)
    cookie = _cookie_attrs(response)
    assert cookie["value"] and "httponly" in cookie
    assert "max-age" not in cookie and "expires" not in cookie


async def test_unknown_session_transport_is_a_422(client):
    response = await _sign_in_with(client, {"X-Session-Transport": "localstorage"})
    assert response.status_code == 422


async def test_body_flow_sets_no_cookie(client):
    response = await _sign_in_with(client, {})
    assert response.json()["refresh_token"]
    assert "set-cookie" not in response.headers


async def test_refresh_via_cookie_rotates_and_resets_the_cookie(client):
    first = _cookie_attrs(await _sign_in_with(client, COOKIE_MODE))["value"]
    refreshed = await client.post("/api/v1/auth/refresh", headers=COOKIE_MODE)
    assert refreshed.status_code == 200
    assert refreshed.json()["refresh_token"] is None
    second = _cookie_attrs(refreshed)["value"]
    assert second and second != first
    # The rotated-out token is dead.
    assert (await client.post("/api/v1/auth/refresh", json={"refresh_token": first})).status_code == 401


async def test_refresh_reads_the_cookie_only_with_the_custom_header(client):
    """CSRF guard: a cross-site form post carries the cookie but can't add the header without a preflight."""
    await _sign_in_with(client, COOKIE_MODE)
    assert client.cookies.get("ac_refresh")
    response = await client.post("/api/v1/auth/refresh")
    assert response.status_code == 401
    assert response.json()["code"] == "auth_error"


async def test_refresh_without_any_token_is_a_401(client):
    response = await client.post("/api/v1/auth/refresh", headers=COOKIE_MODE)
    assert response.status_code == 401
    assert set(response.json()) >= {"code", "message"}


async def test_failed_cookie_refresh_clears_the_cookie(client):
    await _sign_in_with(client, COOKIE_MODE)
    client.cookies.set("ac_refresh", "garbage", path="/api/v1/auth")
    response = await client.post("/api/v1/auth/refresh", headers=COOKIE_MODE)
    assert response.status_code == 401
    cookie = _cookie_attrs(response)
    assert cookie["name"] == "ac_refresh"
    assert cookie["max-age"] == "0"
    assert cookie["path"] == "/api/v1/auth"


async def test_logout_via_cookie_revokes_the_family_and_clears_the_cookie(client):
    token = _cookie_attrs(await _sign_in_with(client, COOKIE_MODE))["value"]
    response = await client.post("/api/v1/auth/logout", headers=COOKIE_MODE)
    assert response.status_code == 204
    cookie = _cookie_attrs(response)
    assert cookie["max-age"] == "0" and cookie["path"] == "/api/v1/auth"
    assert (await client.post("/api/v1/auth/refresh", json={"refresh_token": token})).status_code == 401


async def test_logout_without_any_token_is_still_204(client):
    assert (await client.post("/api/v1/auth/logout")).status_code == 204
    cleared = await client.post("/api/v1/auth/logout", headers=COOKIE_MODE)
    assert cleared.status_code == 204
    assert _cookie_attrs(cleared)["max-age"] == "0"


async def test_body_token_wins_over_the_cookie(client, override):
    override(get_auth_settings, lambda: AuthSettings(sms_provider="console", otp_resend_cooldown_seconds=0))
    cookie_token = _cookie_attrs(await _sign_in_with(client, COOKIE_MODE))["value"]
    client.cookies.clear()
    body_token = (await _sign_in(client))["refresh_token"]
    client.cookies.set("ac_refresh", cookie_token, path="/api/v1/auth")
    response = await client.post("/api/v1/auth/logout", json={"refresh_token": body_token}, headers=COOKIE_MODE)
    assert response.status_code == 204
    assert (await client.post("/api/v1/auth/refresh", json={"refresh_token": body_token})).status_code == 401
    assert (await client.post("/api/v1/auth/refresh", json={"refresh_token": cookie_token})).status_code == 200


async def test_cors_preflight_from_admin_allows_credentials_and_the_transport_header(client):
    response = await client.options(
        "/api/v1/auth/refresh",
        headers={
            "Origin": ADMIN_ORIGIN,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type, x-session-transport",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == ADMIN_ORIGIN
    assert response.headers["access-control-allow-credentials"] == "true"
    assert "x-session-transport" in response.headers["access-control-allow-headers"].lower()


async def test_local_cors_echoes_the_origin_with_credentials(engine, monkeypatch):
    """Local allows any origin; with credentials the browser needs the concrete origin, never `*`."""
    from httpx import ASGITransport, AsyncClient

    from app.main import create_app

    monkeypatch.setenv("ENVIRONMENT", "local")
    get_settings.cache_clear()
    try:
        local_app = create_app()
    finally:
        monkeypatch.undo()
        get_settings.cache_clear()
    origin = "http://localhost:5174"
    async with AsyncClient(transport=ASGITransport(app=local_app), base_url="http://test") as local:
        response = await local.options(
            "/api/v1/auth/refresh",
            headers={
                "Origin": origin,
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "x-session-transport",
            },
        )
    assert response.headers["access-control-allow-origin"] == origin
    assert response.headers["access-control-allow-credentials"] == "true"
