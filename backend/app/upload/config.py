"""Image host settings. "fake" keeps everything local (tests, offline dev); production needs Cloudinary."""

from functools import lru_cache
from typing import Literal, Self

from pydantic import SecretStr, model_validator

from app.core.config import AppSettings


class UploadSettings(AppSettings):
    storage_provider: Literal["fake", "cloudinary"] = "fake"
    cloudinary_cloud_name: str = ""
    cloudinary_api_key: str = ""
    cloudinary_api_secret: SecretStr = SecretStr("")

    @model_validator(mode="after")
    def _real_storage_in_production(self) -> Self:
        if self.storage_provider == "fake" and self.is_production:
            raise ValueError("STORAGE_PROVIDER=fake stores nothing; it cannot run with ENVIRONMENT=production")
        if self.storage_provider == "cloudinary" and not (
            self.cloudinary_cloud_name and self.cloudinary_api_key and self.cloudinary_api_secret.get_secret_value()
        ):
            raise ValueError("STORAGE_PROVIDER=cloudinary needs CLOUDINARY_CLOUD_NAME, _API_KEY and _API_SECRET")
        return self


@lru_cache
def get_upload_settings() -> UploadSettings:
    return UploadSettings()
