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
    fast2sms_api_key: str = ""
    # Image storage: "fake" (tests/dev without keys) or "cloudinary".
    storage_provider: str = "fake"
    cloudinary_cloud_name: str = ""
    cloudinary_api_key: str = ""
    cloudinary_api_secret: str = ""
    # Cities an artist can pick; a table replaces this once admins edit it.
    cities: list[str] = ["Bangalore", "Mumbai", "Delhi NCR", "Hyderabad", "Chennai", "Pune"]
    # CORS origins when DEBUG=false (the admin web app).
    admin_origins: list[str] = ["http://localhost:5173"]


@lru_cache
def get_settings() -> Settings:
    return Settings()
