"""Security primitives contract: OTP format/hashing, JWT typing, token hashing."""

import uuid

import jwt as pyjwt
import pytest

from app.core.security import (
    create_access_token, create_refresh_token, decode_token, generate_otp, hash_otp, hash_token,
)


def test_generate_otp_is_six_digits():
    for _ in range(20):
        code = generate_otp()
        assert len(code) == 6 and code.isdigit()


def test_hash_otp_is_deterministic_and_salted():
    assert hash_otp("123456") == hash_otp("123456")
    assert hash_otp("123456") != hash_otp("654321")


def test_access_token_roundtrip():
    user_id = uuid.uuid4()
    token = create_access_token(user_id)
    payload = decode_token(token)
    assert payload["sub"] == str(user_id)
    assert payload["type"] == "access"


def test_refresh_token_is_marked_as_refresh():
    payload = decode_token(create_refresh_token(uuid.uuid4())[0])
    assert payload["type"] == "refresh"


def test_decode_rejects_tampered_token():
    with pytest.raises(pyjwt.PyJWTError):
        decode_token("not.a.token")


def test_hash_token_is_sha256_hex():
    assert len(hash_token("abc")) == 64
