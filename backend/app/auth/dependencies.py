from fastapi import Cookie, Depends, Header
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import constants
from app.auth.config import AuthSettings, get_auth_settings
from app.auth.constants import (
    INSECURE_COOKIE_ENVIRONMENTS,
    REFRESH_COOKIE_NAME,
    SESSION_TRANSPORT_HEADER,
    SessionTransport,
)
from app.auth.schemas import RefreshRequest
from app.auth.service import AuthService
from app.auth.sms import SMSProvider, get_sms_provider
from app.auth.utils import SECONDS_PER_DAY, RefreshCookie
from app.core.config import Settings, get_settings
from app.core.database import get_db
from app.core.rate_limit import Limit, limit_by_ip
from app.shared.clock import Clock, get_clock


def otp_request_per_phone() -> Limit:
    return constants.OTP_REQUEST_PER_PHONE


def otp_verify_per_phone() -> Limit:
    return constants.OTP_VERIFY_PER_PHONE


def get_auth_service(
    session: AsyncSession = Depends(get_db, scope="function"),
    sms: SMSProvider = Depends(get_sms_provider),
    settings: AuthSettings = Depends(get_auth_settings),
    request_limit: Limit = Depends(otp_request_per_phone),
    verify_limit: Limit = Depends(otp_verify_per_phone),
    clock: Clock = Depends(get_clock),
) -> AuthService:
    return AuthService(session, sms, settings, clock, request_limit=request_limit, verify_limit=verify_limit)


# Per-IP allowances, as route dependencies. Each limit getter is a dependency, so tests can override it.
def otp_request_per_ip() -> Limit:
    return constants.OTP_REQUEST_PER_IP


def otp_verify_per_ip() -> Limit:
    return constants.OTP_VERIFY_PER_IP


def refresh_per_ip() -> Limit:
    return constants.REFRESH_PER_IP


limit_otp_request = limit_by_ip("otp_request", otp_request_per_ip)
limit_otp_verify = limit_by_ip("otp_verify", otp_verify_per_ip)
limit_refresh = limit_by_ip("refresh", refresh_per_ip)


# --- refresh-token transport: JSON body (mobile) or httpOnly cookie (admin web) -------------------


async def session_transport(
    transport: SessionTransport | None = Header(
        None,
        alias=SESSION_TRANSPORT_HEADER,
        description="Opt in to the httpOnly refresh cookie: `cookie` (persistent) or `cookie-session`.",
    ),
) -> SessionTransport | None:
    return transport


async def refresh_cookie(
    transport: SessionTransport | None = Depends(session_transport),
    settings: Settings = Depends(get_settings),
) -> RefreshCookie | None:
    """How to set/clear the cookie on this request; None when the caller uses the JSON body."""
    if transport is None:
        return None
    return RefreshCookie(
        transport=transport,
        secure=settings.environment not in INSECURE_COOKIE_ENVIRONMENTS,
        lifetime_seconds=settings.refresh_token_ttl_days * SECONDS_PER_DAY,
    )


async def presented_refresh_token(
    body: RefreshRequest | None = None,
    transport: SessionTransport | None = Depends(session_transport),
    cookie_token: str | None = Cookie(None, alias=REFRESH_COOKIE_NAME),
) -> str | None:
    """The body's token wins. The cookie is read only alongside the custom header: a cross-site form
    can carry the cookie but can't add that header without a CORS preflight, which it would fail."""
    if body is not None:
        return body.refresh_token
    return cookie_token if transport is not None else None
