"""Security primitives: OTP generation/hashing and JWT creation.

Rule of thumb baked in here: low-entropy secrets (6-digit OTPs) get keyed
hashing (HMAC); high-entropy secrets (JWT refresh tokens) get plain sha256.
Plaintext OTPs and refresh tokens are never stored.
"""

import hashlib
import hmac
import secrets
import uuid as uuid_mod
from datetime import UTC, datetime, timedelta

import jwt

from app.core.config import get_settings

JWT_ALGORITHM = "HS256"  # pinned: never read from config or the token header
JWT_ISSUER = "art-circle-api"
JWT_AUDIENCE = "art-circle"


def _secret() -> str:
    return get_settings().jwt_secret.get_secret_value()


def generate_otp() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def hash_otp(code: str) -> str:
    return hmac.new(_secret().encode(), code.encode(), hashlib.sha256).hexdigest()


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _create_token(user_id: uuid_mod.UUID, token_type: str, ttl: timedelta) -> tuple[str, str]:
    jti = str(uuid_mod.uuid4())
    now = datetime.now(UTC)
    payload = {
        "sub": str(user_id),
        "type": token_type,
        "jti": jti,
        "iss": JWT_ISSUER,
        "aud": JWT_AUDIENCE,
        "iat": now,
        "exp": now + ttl,
    }
    return jwt.encode(payload, _secret(), algorithm=JWT_ALGORITHM), jti


def create_access_token(user_id: uuid_mod.UUID) -> str:
    settings = get_settings()
    token, _ = _create_token(user_id, "access", timedelta(minutes=settings.access_token_ttl_minutes))
    return token


def create_refresh_token(user_id: uuid_mod.UUID) -> tuple[str, str]:
    settings = get_settings()
    return _create_token(user_id, "refresh", timedelta(days=settings.refresh_token_ttl_days))


def decode_token(token: str) -> dict:
    return jwt.decode(
        token,
        _secret(),
        algorithms=[JWT_ALGORITHM],
        audience=JWT_AUDIENCE,
        issuer=JWT_ISSUER,
        options={"require": ["exp", "iat", "sub", "type", "jti", "iss", "aud"]},
    )
