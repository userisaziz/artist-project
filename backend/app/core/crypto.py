"""At-rest encryption for Aadhaar numbers (Fernet: AES-128-CBC + HMAC-SHA256, random IV per token).

The key lives in settings, never in the database; losing it makes stored numbers unrecoverable.
"""

from cryptography.fernet import Fernet

from app.core.config import get_settings


def _fernet() -> Fernet:
    return Fernet(get_settings().aadhaar_encryption_key.get_secret_value().encode())


def encrypt_aadhaar(number: str) -> str:
    return _fernet().encrypt(number.encode()).decode()


def decrypt_aadhaar(token: str) -> str:
    return _fernet().decrypt(token.encode()).decode()
