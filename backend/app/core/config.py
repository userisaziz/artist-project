"""Typed application settings — the single source of truth for configuration.

Loaded once from `.env` (pydantic-settings maps e.g. DATABASE_URL -> database_url).
If a required value is missing, the app fails here at startup with a readable
error instead of mysteriously at the first request.
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

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


@lru_cache
def get_settings() -> Settings:
    return Settings()
