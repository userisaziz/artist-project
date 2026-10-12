"""Aadhaar number rules (Verhoeff checksum) and at-rest encryption."""

import pytest

from app.core.crypto import decrypt_aadhaar, encrypt_aadhaar
from app.utils.aadhaar import is_valid_aadhaar, mask_aadhaar_last4

VALID = ["234123412346", "498765432102", "567812345678"]  # generated, not real people


@pytest.mark.parametrize("number", VALID)
def test_valid_numbers_pass(number):
    assert is_valid_aadhaar(number)


@pytest.mark.parametrize("number", [
    "234123412347",   # checksum off by one
    "034123412346",   # leading 0
    "134123412346",   # leading 1
    "23412341234",    # 11 digits
    "2341234123460",  # 13 digits
    "2341 2341 2346", # spaces are stripped by the service, not here
    "23412341234a",
    "",
])
def test_invalid_numbers_fail(number):
    assert not is_valid_aadhaar(number)


def test_mask_shows_only_last_four():
    assert mask_aadhaar_last4("4412") == "•••• •••• 4412"


def test_encryption_round_trips_and_hides_the_number():
    token = encrypt_aadhaar("234123412346")
    assert "234123412346" not in token
    assert decrypt_aadhaar(token) == "234123412346"
    assert encrypt_aadhaar("234123412346") != token  # Fernet adds a random IV each time


def test_settings_reject_an_invalid_key(monkeypatch):
    from pydantic import ValidationError as PydanticValidationError

    from app.core.config import Settings

    monkeypatch.setenv("AADHAAR_ENCRYPTION_KEY", "not-a-fernet-key")
    with pytest.raises(PydanticValidationError) as excinfo:
        Settings()
    assert "not-a-fernet-key" not in str(excinfo.value)
