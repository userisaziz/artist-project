"""Sign-in settings: one-time codes, SMS delivery and request limits for the auth endpoints."""

from functools import lru_cache
from typing import Literal, Self

from pydantic import Field, SecretStr, model_validator

from app.core.config import AppSettings

OTP_LENGTH = 6  # app.core.security.generate_otp


class AuthSettings(AppSettings):
    otp_ttl_minutes: int = Field(5, ge=1, le=30)
    otp_max_attempts: int = Field(5, ge=1, le=10)
    otp_resend_cooldown_seconds: int = Field(60, ge=0)
    # "console" logs codes instead of sending them: never allowed in production.
    sms_provider: Literal["console", "fast2sms"] = "console"
    fast2sms_api_key: SecretStr = SecretStr("")
    sms_timeout_seconds: float = Field(5.0, gt=0, le=30)
    # Development/staging only: every OTP issued is this code instead of a random one (any number signs in with
    # it). Verification is unchanged (expiry, attempts, limits). Never allowed in production.
    dev_otp_code: SecretStr = SecretStr("")

    @model_validator(mode="after")
    def _real_sms_in_production(self) -> Self:
        if self.sms_provider == "console" and self.is_production:
            raise ValueError("SMS_PROVIDER=console only logs codes; it cannot run with ENVIRONMENT=production")
        dev_code = self.dev_otp_code.get_secret_value()
        if dev_code and self.is_production:
            raise ValueError("DEV_OTP_CODE lets anyone sign in; it cannot run with ENVIRONMENT=production")
        if dev_code and not (len(dev_code) == OTP_LENGTH and dev_code.isdigit()):
            raise ValueError(f"DEV_OTP_CODE must be {OTP_LENGTH} digits")
        if self.sms_provider == "fast2sms" and not self.fast2sms_api_key.get_secret_value():
            raise ValueError("SMS_PROVIDER=fast2sms needs FAST2SMS_API_KEY")
        return self


@lru_cache
def get_auth_settings() -> AuthSettings:
    return AuthSettings()
