"""Security primitives: OTP generation/hashing and JWT creation.

Rule of thumb baked in here: low-entropy secrets (6-digit OTPs) get keyed
hashing (HMAC); high-entropy secrets (JWT refresh tokens) get plain sha256.
Plaintext OTPs and refresh tokens are never stored.
"""

import hashlib
import hmac
import secrets
import uuid as uuid_mod
from datetime import datetime, timedelta, timezone

import jwt

from app.core.config import get_settings


def generate_otp() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def hash_otp(code: str) -> str:
    settings = get_settings()
    return hmac.new(settings.jwt_secret.encode(), code.encode(), hashlib.sha256).hexdigest()


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _create_token(user_id, token_type: str, ttl: timedelta) -> tuple[str, str]:
    settings = get_settings()
    jti = str(uuid_mod.uuid4())
    now = datetime.now(timezone.utc)
    payload = {"sub": str(user_id), "type": token_type, "jti": jti, "iat": now, "exp": now + ttl}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm), jti


def create_access_token(user_id) -> str:
    settings = get_settings()
    token, _ = _create_token(user_id, "access", timedelta(minutes=settings.access_token_ttl_minutes))
    return token


def create_refresh_token(user_id) -> tuple[str, str]:
    settings = get_settings()
    return _create_token(user_id, "refresh", timedelta(days=settings.refresh_token_ttl_days))


def decode_token(token: str) -> dict:
    settings = get_settings()
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
