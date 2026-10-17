"""All auth rules live here — routes just forward to these methods.

Invariants enforced:
- OTP requests and verifies for one phone are serialised (advisory lock): the resend cooldown can't be
  raced, one code signs in once, and parallel wrong guesses all count toward the attempt lockout.
- A resend invalidates earlier codes; verify is one-shot.
- The code is saved before the SMS goes out; if delivery fails the code is withdrawn (no cooldown
  for a text that never arrived) and the caller gets 503.
- Wrong guesses are persisted before the error raises, else the rollback in get_db would discard
  them and the attempt lockout could never trigger.
- Refresh tokens rotate on every use, under a row lock so two refreshes can't both rotate one token.
  Replaying an already-rotated token revokes its whole family (it was stolen or leaked), and logout
  revokes the family too.
"""

import uuid
from datetime import timedelta

import jwt as pyjwt
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.config import AuthSettings
from app.auth.models import OtpCode, RefreshToken
from app.auth.repository import AuthRepository
from app.auth.sms import SMSProvider
from app.core.audit import audit, mask_phone
from app.core.config import get_settings
from app.core.exceptions import AuthError, RateLimitError
from app.core.rate_limit import Limit, hit
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    generate_otp,
    hash_otp,
    hash_token,
)
from app.shared.clock import Clock
from app.user.models import User
from app.user.repository import UserRepository


class AuthService:
    def __init__(
        self,
        session: AsyncSession,
        sms: SMSProvider,
        settings: AuthSettings,
        clock: Clock,
        *,
        request_limit: Limit,
        verify_limit: Limit,
    ):
        self.session = session
        self.auth = AuthRepository(session)
        self.users = UserRepository(session)
        self.sms = sms
        self.settings = settings
        self.clock = clock
        self.refresh_ttl = timedelta(days=get_settings().refresh_token_ttl_days)
        self.request_limit = request_limit
        self.verify_limit = verify_limit

    async def request_otp(self, phone: str) -> None:
        await hit(self.session, f"otp_request:phone:{phone}", self.request_limit, self.clock.now())
        await self.auth.lock_phone(phone)
        now = self.clock.now()
        latest = await self.auth.latest_otp(phone)
        if latest and (now - latest.created_at).total_seconds() < self.settings.otp_resend_cooldown_seconds:
            raise RateLimitError("Please wait before requesting another code")
        for otp in await self.auth.unconsumed_otps(phone):
            otp.consumed_at = now
        code = generate_otp()
        otp = OtpCode(
            phone=phone, code_hash=hash_otp(code), expires_at=now + timedelta(minutes=self.settings.otp_ttl_minutes)
        )
        self.auth.add(otp)
        await self.session.commit()  # saved (and the lock released) before the slow network call
        try:
            await self.sms.send_otp(phone, code)
        except Exception:
            await self.auth.delete(otp)
            await self.session.commit()
            audit("auth.otp_delivery_failed", phone=mask_phone(phone))
            raise
        audit("auth.otp_requested", phone=mask_phone(phone))

    async def verify_otp(self, phone: str, code: str) -> tuple[User, str, str]:
        await hit(self.session, f"otp_verify:phone:{phone}", self.verify_limit, self.clock.now())
        await self.auth.lock_phone(phone)  # parallel verifies (or guesses) for one phone run one at a time
        otp = await self.auth.latest_active_otp(phone, self.clock.now())
        if otp is None or otp.attempts >= self.settings.otp_max_attempts:
            audit("auth.otp_rejected", phone=mask_phone(phone), reason="no_active_code")
            raise AuthError("Invalid or expired code")
        if hash_otp(code) != otp.code_hash:
            otp.attempts += 1
            await self.session.commit()  # the failed attempt must survive the error rollback
            locked = otp.attempts >= self.settings.otp_max_attempts
            audit("auth.otp_rejected", phone=mask_phone(phone), reason="locked" if locked else "wrong_code")
            raise AuthError("Invalid or expired code")
        otp.consumed_at = self.clock.now()

        user = await self.users.by_phone(phone)
        is_new = user is None
        if user is None:  # just-in-time registration
            user = User(phone=phone, is_phone_verified=True, role_grants=[])
            self.users.add(user)
            await self.session.flush()
        if not user.is_active:
            raise AuthError("User not found")
        user.is_phone_verified = True

        access = create_access_token(user.id)
        refresh = self._issue_refresh(user.id, family_id=uuid.uuid4())
        audit("auth.signed_in", user_id=str(user.id), new_user=is_new)
        return user, access, refresh

    async def refresh(self, refresh_token: str) -> tuple[User, str, str]:
        stored = await self._stored_refresh(refresh_token, lock=True)
        now = self.clock.now()
        if stored.revoked_at is not None:
            # A rotated token came back: someone else holds a copy. End every session from that sign-in.
            await self.auth.revoke_family(stored.family_id, now)
            await self.session.commit()
            audit("auth.refresh_reuse_detected", user_id=str(stored.user_id), family_id=str(stored.family_id))
            raise AuthError("Refresh token expired or revoked")
        if stored.expires_at < now:
            raise AuthError("Refresh token expired or revoked")
        stored.revoked_at = now  # rotation: the old token dies with this request

        user = await self.users.get(stored.user_id)
        if user is None or not user.is_active:
            await self.auth.revoke_family(stored.family_id, now)
            await self.session.commit()
            raise AuthError("User not found")
        access = create_access_token(user.id)
        refresh = self._issue_refresh(user.id, family_id=stored.family_id)
        return user, access, refresh

    async def logout(self, refresh_token: str) -> None:
        """Ends the session this refresh token belongs to. Unknown or already-dead tokens are a no-op."""
        try:
            stored = await self._stored_refresh(refresh_token)
        except AuthError:
            return
        await self.auth.revoke_family(stored.family_id, self.clock.now())
        audit("auth.logged_out", user_id=str(stored.user_id))

    async def _stored_refresh(self, refresh_token: str, *, lock: bool = False) -> RefreshToken:
        try:
            payload = decode_token(refresh_token)
        except pyjwt.PyJWTError as exc:
            raise AuthError("Invalid refresh token") from exc
        if payload.get("type") != "refresh":
            raise AuthError("Invalid refresh token")
        stored = await self.auth.refresh_token_by_hash(hash_token(refresh_token), lock=lock)
        if stored is None:
            raise AuthError("Refresh token expired or revoked")
        return stored

    def _issue_refresh(self, user_id: uuid.UUID, family_id: uuid.UUID) -> str:
        token, _jti = create_refresh_token(user_id)
        self.auth.add(
            RefreshToken(
                user_id=user_id,
                family_id=family_id,
                token_hash=hash_token(token),
                expires_at=self.clock.now() + self.refresh_ttl,
            )
        )
        return token
