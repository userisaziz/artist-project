"""Image host settings. "fake" keeps everything local (tests, offline dev); production needs Cloudinary or R2."""

from functools import lru_cache
from typing import Literal, Self

from pydantic import SecretStr, model_validator

from app.core.config import AppSettings


class UploadSettings(AppSettings):
    storage_provider: Literal["fake", "cloudinary", "r2"] = "fake"
    cloudinary_cloud_name: str = ""
    cloudinary_api_key: str = ""
    cloudinary_api_secret: SecretStr = SecretStr("")
    r2_account_id: str = ""
    r2_access_key_id: str = ""
    r2_secret_access_key: SecretStr = SecretStr("")
    r2_bucket: str = ""  # public images, served from r2_public_url
    r2_private_bucket: str = ""  # identity documents: never public, read through expiring signed links
    r2_public_url: str = ""  # the public bucket's r2.dev or custom-domain address

    @model_validator(mode="after")
    def _real_storage_in_production(self) -> Self:
        if self.storage_provider == "fake" and self.is_production:
            raise ValueError("STORAGE_PROVIDER=fake stores nothing; it cannot run with ENVIRONMENT=production")
        if self.storage_provider == "cloudinary" and not (
            self.cloudinary_cloud_name and self.cloudinary_api_key and self.cloudinary_api_secret.get_secret_value()
        ):
            raise ValueError("STORAGE_PROVIDER=cloudinary needs CLOUDINARY_CLOUD_NAME, _API_KEY and _API_SECRET")
        if self.storage_provider == "r2":
            self._check_r2()
        return self

    def _check_r2(self) -> None:
        required = {
            "R2_ACCOUNT_ID": self.r2_account_id,
            "R2_ACCESS_KEY_ID": self.r2_access_key_id,
            "R2_SECRET_ACCESS_KEY": self.r2_secret_access_key.get_secret_value(),
            "R2_BUCKET": self.r2_bucket,
            "R2_PRIVATE_BUCKET": self.r2_private_bucket,
            "R2_PUBLIC_URL": self.r2_public_url,
        }
        missing = [name for name, value in required.items() if not value]
        if missing:
            raise ValueError(f"STORAGE_PROVIDER=r2 needs {', '.join(missing)}")
        if self.r2_private_bucket == self.r2_bucket:
            raise ValueError("R2_PRIVATE_BUCKET must be a separate private bucket: the public one exposes every key")


@lru_cache
def get_upload_settings() -> UploadSettings:
    return UploadSettings()
