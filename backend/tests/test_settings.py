"""Startup guards in settings: unsafe production configuration fails at boot, not at the first request."""

import pytest
from pydantic import SecretStr, ValidationError

from app.auth.config import AuthSettings
from app.booking.config import BookingSettings
from app.core.config import AppSettings, Settings
from app.upload.config import UploadSettings

STRONG_SECRET = "x" * 32


def test_environment_defaults_to_production(monkeypatch):
    monkeypatch.delenv("ENVIRONMENT")
    assert AppSettings(_env_file=None).environment == "production"


def test_mock_payments_refuse_to_run_in_production():
    with pytest.raises(ValidationError, match="PAYMENT_PROVIDER=mock"):
        BookingSettings(environment="production", payment_provider="mock")
    assert BookingSettings(environment="staging", payment_provider="mock").payment_provider == "mock"


def test_direct_upi_payments_run_in_production():
    assert BookingSettings(environment="production", payment_provider="direct").payment_provider == "direct"


def test_unknown_payment_provider_is_rejected():
    with pytest.raises(ValidationError):
        BookingSettings(payment_provider="razorpay")


def test_console_sms_refuses_to_run_in_production():
    with pytest.raises(ValidationError, match="SMS_PROVIDER=console"):
        AuthSettings(environment="production", sms_provider="console")


def test_fast2sms_needs_an_api_key():
    with pytest.raises(ValidationError, match="FAST2SMS_API_KEY"):
        AuthSettings(environment="staging", sms_provider="fast2sms", fast2sms_api_key=SecretStr(""))


def test_fake_storage_refuses_to_run_in_production():
    with pytest.raises(ValidationError, match="STORAGE_PROVIDER=fake"):
        UploadSettings(environment="production", storage_provider="fake")


def test_cloudinary_needs_all_credentials():
    with pytest.raises(ValidationError, match="CLOUDINARY"):
        UploadSettings(environment="staging", storage_provider="cloudinary", cloudinary_cloud_name="demo")


def test_short_jwt_secret_is_rejected():
    with pytest.raises(ValidationError) as excinfo:
        Settings(jwt_secret="too-short")
    assert "too-short" not in str(excinfo.value)


def test_docs_are_off_in_production():
    assert Settings(environment="production", jwt_secret=STRONG_SECRET).docs_enabled is False
    assert Settings(environment="staging", jwt_secret=STRONG_SECRET).docs_enabled is True
