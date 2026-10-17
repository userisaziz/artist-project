"""Typed application settings — the single source of truth for configuration.

Loaded once from `.env` (pydantic-settings maps e.g. DATABASE_URL -> database_url).
If a required value is missing, the app fails here at startup with a readable
error instead of mysteriously at the first request.
"""

from functools import lru_cache

from pydantic import SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore", hide_input_in_errors=True
    )
    database_url: str
    test_database_url: str
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    access_token_ttl_minutes: int = 15
    refresh_token_ttl_days: int = 7
    otp_ttl_minutes: int = 5
    otp_max_attempts: int = 5
    otp_resend_cooldown_seconds: int = 60
    debug: bool = True
    sms_provider: str = "console"
    fast2sms_api_key: str = ""
    # Image storage: "fake" (tests/dev without keys) or "cloudinary".
    storage_provider: str = "fake"
    cloudinary_cloud_name: str = ""
    cloudinary_api_key: str = ""
    cloudinary_api_secret: str = ""
    # Fernet key for stored Aadhaar numbers (required: the app refuses to start without it).
    aadhaar_encryption_key: SecretStr

    @field_validator("aadhaar_encryption_key")
    @classmethod
    def _valid_fernet_key(cls, value: SecretStr) -> SecretStr:
        from cryptography.fernet import Fernet

        try:
            Fernet(value.get_secret_value().encode())
        except ValueError:  # deliberately not chained: the message must never echo the key
            raise ValueError("AADHAAR_ENCRYPTION_KEY must be a 32-byte url-safe base64 Fernet key") from None
        return value

    @model_validator(mode="after")
    def _no_mock_payments_in_production(self) -> "Settings":
        if self.payment_provider != "mock":
            raise ValueError(f"Unknown PAYMENT_PROVIDER: {self.payment_provider!r} (supported: mock)")
        if not self.debug:
            raise ValueError("PAYMENT_PROVIDER=mock takes no real deposits; it only runs with DEBUG=true")
        return self

    # Cities an artist can pick; a table replaces this once admins edit it.
    cities: list[str] = ["Bangalore", "Mumbai", "Delhi NCR", "Hyderabad", "Chennai", "Pune"]
    # Bookings (Increment 5). Money values are copied onto each booking, so changes only affect new ones.
    platform_fee_paise: int = 9_900  # ₹99 charged to the customer…
    platform_fee_waived_from_paise: int = 2_500_000  # …unless the service costs ₹25,000 or more
    deposit_percent: int = 30  # of the total, paid when requesting
    commission_percent: int = 10  # of the service price, kept from the artist
    booking_accept_hours: int = 3  # the artist's window to accept a request
    free_cancel_hours: int = 72  # customer cancellations this far ahead get the deposit back
    slot_first_hour: int = 9  # hourly start times, IST
    slot_last_hour: int = 17
    booking_lead_hours: int = 2  # earliest bookable start, from now
    booking_horizon_days: int = 60
    max_open_requests_per_customer: int = 3  # unanswered requests at once, so one account can't squat on slots
    # Reviews (Increment 6): open this long after completion; these phrases hide a review for moderation.
    review_window_days: int = 30
    review_blocked_words: list[str] = ["scam", "fraud", "call me", "whatsapp me"]
    # Deposit payments. "mock" marks the deposit paid with no gateway: dev only (see _no_mock_payments_in_production).
    payment_provider: str = "mock"
    # CORS origins when DEBUG=false (the admin web app).
    admin_origins: list[str] = ["http://localhost:5173"]


@lru_cache
def get_settings() -> Settings:
    return Settings()
