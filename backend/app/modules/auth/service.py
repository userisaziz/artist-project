"""All auth rules live here — routes just forward to these three methods.

Invariants enforced: OTP resend invalidates earlier codes; verify is one-shot;
refresh tokens rotate on every use (old token dies with the request).
"""

import uuid
from datetime import datetime, timedelta, timezone

import jwt as pyjwt
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_db
from app.core.exceptions import AuthError, RateLimitError
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    generate_otp,
    hash_otp,
    hash_token,
)
from app.modules.auth.models import OtpCode, RefreshToken
from app.modules.auth.repository import AuthRepository
from app.modules.auth.sms import SMSProvider, get_sms_provider
from app.modules.users.models import User
from app.modules.users.repository import UserRepository


class AuthService:
    def __init__(self, session: AsyncSession, sms: SMSProvider | None = None):
        self.session = session
        self.auth = AuthRepository(session)
        self.users = UserRepository(session)
        self.sms = sms or get_sms_provider()
        self.settings = get_settings()

    async def request_otp(self, phone: str) -> None:
        now = datetime.now(timezone.utc)
        latest = await self.auth.latest_otp(phone)
        if latest and (now - latest.created_at).total_seconds() < self.settings.otp_resend_cooldown_seconds:
            raise RateLimitError("Please wait before requesting another code")
        for otp in await self.auth.unconsumed_otps(phone):
            otp.consumed_at = now
        code = generate_otp()
        self.auth.add(
            OtpCode(
                phone=phone,
                code_hash=hash_otp(code),
                expires_at=now + timedelta(minutes=self.settings.otp_ttl_minutes),
            )
        )
        await self.sms.send_otp(phone, code)

    async def verify_otp(self, phone: str, code: str) -> tuple[User, str, str]:
        otp = await self.auth.latest_active_otp(phone, datetime.now(timezone.utc))
        if otp is None or otp.attempts >= self.settings.otp_max_attempts:
            raise AuthError("Invalid or expired code")
        if hash_otp(code) != otp.code_hash:
            otp.attempts += 1
            raise AuthError("Invalid or expired code")
        otp.consumed_at = datetime.now(timezone.utc)

        user = await self.users.by_phone(phone)
        if user is None:  # just-in-time registration
            user = User(phone=phone, is_phone_verified=True, role_grants=[])
            self.users.add(user)
            await self.session.flush()
        user.is_phone_verified = True

        access = create_access_token(user.id)
        refresh, _jti = create_refresh_token(user.id)
        self.auth.add(
            RefreshToken(
                user_id=user.id,
                token_hash=hash_token(refresh),
                expires_at=datetime.now(timezone.utc) + timedelta(days=self.settings.refresh_token_ttl_days),
            )
        )
        return user, access, refresh

    async def refresh(self, refresh_token: str) -> tuple[User, str, str]:
        try:
            payload = decode_token(refresh_token)
        except pyjwt.PyJWTError as exc:
            raise AuthError("Invalid refresh token") from exc
        if payload.get("type") != "refresh":
            raise AuthError("Invalid refresh token")
        stored = await self.auth.refresh_token_by_hash(hash_token(refresh_token))
        now = datetime.now(timezone.utc)
        if stored is None or stored.revoked_at is not None or stored.expires_at < now:
            raise AuthError("Refresh token expired or revoked")
        stored.revoked_at = now  # rotation: the old token dies with this request

        user = await self.users.get(uuid.UUID(payload["sub"]))
        if user is None or not user.is_active:
            raise AuthError("User not found")
        access = create_access_token(user.id)
        refresh, _jti = create_refresh_token(user.id)
        self.auth.add(
            RefreshToken(
                user_id=user.id,
                token_hash=hash_token(refresh),
                expires_at=now + timedelta(days=self.settings.refresh_token_ttl_days),
            )
        )
        return user, access, refresh


def get_auth_service(session: AsyncSession = Depends(get_db)) -> AuthService:
    return AuthService(session)
