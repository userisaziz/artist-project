"""Global settings: environment, database, HTTP edge and the app-wide secrets (JWT, Aadhaar key).

Domain-specific values live in each domain's own `config.py` (auth, booking, review, upload,
artist), all built on `AppSettings` so they read the same `.env` and know the environment.
A missing or unsafe value fails here at startup with a readable error, never at the first request.
"""

from functools import lru_cache
from typing import Literal

from pydantic import AliasChoices, Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

Environment = Literal["local", "test", "staging", "production"]


class AppSettings(BaseSettings):
    """Base for every settings class. Defaults to production, so a forgotten ENVIRONMENT fails safe."""

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore", hide_input_in_errors=True
    )
    environment: Environment = "production"

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


class Settings(AppSettings):
    database_url: str
    db_pool_size: int = Field(10, ge=1)
    db_max_overflow: int = Field(10, ge=0)
    db_pool_recycle_seconds: int = Field(1800, ge=60)
    db_statement_timeout_ms: int = Field(15_000, ge=100)

    # JWT signing key (HS256). Also keys the OTP HMAC, so it must be long and random.
    jwt_secret: SecretStr = Field(min_length=32)
    access_token_ttl_minutes: int = Field(15, ge=1, le=60)
    refresh_token_ttl_days: int = Field(7, ge=1, le=90)
    # Fernet key for stored Aadhaar numbers (required: the app refuses to start without it).
    aadhaar_encryption_key: SecretStr

    # Browser origins allowed by CORS (the admin web app). Local runs allow any origin.
    cors_origins: list[str] = Field(
        default=["http://localhost:5173"], validation_alias=AliasChoices("cors_origins", "admin_origins")
    )
    # Host headers accepted; set to the API's public hostnames in production.
    allowed_hosts: list[str] = ["*"]
    max_body_bytes: int = Field(1_048_576, ge=1024)  # JSON only: images upload straight to the image host
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"
    log_json: bool | None = None  # None: JSON everywhere except local

    @field_validator("aadhaar_encryption_key")
    @classmethod
    def _valid_fernet_key(cls, value: SecretStr) -> SecretStr:
        from cryptography.fernet import Fernet

        try:
            Fernet(value.get_secret_value().encode())
        except ValueError:  # deliberately not chained: the message must never echo the key
            raise ValueError("AADHAAR_ENCRYPTION_KEY must be a 32-byte url-safe base64 Fernet key") from None
        return value

    @property
    def docs_enabled(self) -> bool:
        """OpenAPI/docs are a local, test and staging convenience only (best-practices rule)."""
        return self.environment in ("local", "test", "staging")

    @property
    def use_json_logs(self) -> bool:
        return self.environment != "local" if self.log_json is None else self.log_json


@lru_cache
def get_settings() -> Settings:
    return Settings()
