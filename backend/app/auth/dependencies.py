from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import constants
from app.auth.config import AuthSettings, get_auth_settings
from app.auth.service import AuthService
from app.auth.sms import SMSProvider, get_sms_provider
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
