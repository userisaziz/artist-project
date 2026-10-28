"""Pluggable image storage — the one seam between our data and the image host.

Apps upload straight to the host with a signed form from `upload_params`; the DB
keeps only the returned key, and responses turn keys into URLs via `url`. Moving
between hosts is one class + copying files; no stored URLs to rewrite.
"""

import hashlib
import logging
import re
import secrets
import time
import uuid
from abc import ABC, abstractmethod
from functools import lru_cache
from typing import ClassVar, Literal
from urllib.parse import urlencode

import boto3
import httpx
from botocore.client import BaseClient
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError
from fastapi.concurrency import run_in_threadpool

from app.upload.config import get_upload_settings

logger = logging.getLogger("art_circle.storage")

Purpose = Literal["artist_photo", "portfolio", "aadhaar", "post", "shop", "service"]
PRIVATE_PURPOSES = {"aadhaar"}  # stored without a public URL; viewed through expiring signed links
Variant = Literal["thumb", "card", "full"]
ALLOWED_FORMATS = "jpg,jpeg,png,webp,heic"


def new_key(owner_id: uuid.UUID, purpose: Purpose) -> str:
    """Server-chosen key: the signed form pins it, so a client can't write outside its own folder."""
    return f"artists/{owner_id}/{purpose}/{secrets.token_hex(10)}"


def _owns(key: str, owner_id: uuid.UUID, purpose: Purpose) -> bool:
    return re.fullmatch(rf"artists/{re.escape(str(owner_id))}/{purpose}/[0-9a-f]{{20}}", key) is not None


class ImageStorage(ABC):
    @abstractmethod
    def upload_params(self, owner_id: uuid.UUID, purpose: Purpose) -> dict:
        """`{upload_url, fields, key}`: POST `fields` + the file (as `file`) to `upload_url`."""

    def owns(self, key: str, owner_id: uuid.UUID, purpose: Purpose) -> bool:
        return _owns(key, owner_id, purpose)

    @abstractmethod
    def url(self, key: str, variant: Variant) -> str: ...

    @abstractmethod
    def private_url(self, key: str, expires_in: int = 300) -> str:
        """Short-lived link to a private image (admin viewing of identity documents)."""

    @abstractmethod
    async def delete(self, key: str, private: bool = False) -> None:
        """Best effort: a failed delete is logged, never raised (the DB row is already gone)."""


class FakeStorage(ImageStorage):
    """Tests and keyless dev: no network; records deletes so tests can assert them."""

    deleted: ClassVar[list[str]] = []

    def upload_params(self, owner_id: uuid.UUID, purpose: Purpose) -> dict:
        key = new_key(owner_id, purpose)
        return {"upload_url": "https://fake.storage/upload", "fields": {"public_id": key}, "key": key}

    def url(self, key: str, variant: Variant) -> str:
        return f"https://fake.storage/{variant}/{key}.jpg"

    def private_url(self, key: str, expires_in: int = 300) -> str:
        return f"https://fake.storage/private/{key}.jpg?expires_at={int(time.time()) + expires_in}"

    async def delete(self, key: str, private: bool = False) -> None:
        FakeStorage.deleted.append(key)


class CloudinaryStorage(ImageStorage):
    """Signed direct uploads (no SDK): https://cloudinary.com/documentation/authentication_signatures"""

    TRANSFORMS: ClassVar[dict[str, str]] = {
        "thumb": "c_fill,g_auto,w_240,h_240,f_auto,q_auto",
        "card": "c_fill,g_auto,w_720,h_900,f_auto,q_auto",
        "full": "c_limit,w_1600,f_auto,q_auto",
    }

    def __init__(self, cloud_name: str, api_key: str, api_secret: str):
        if not (cloud_name and api_key and api_secret):
            raise RuntimeError("STORAGE_PROVIDER=cloudinary needs CLOUDINARY_CLOUD_NAME, _API_KEY and _API_SECRET")
        self.cloud_name, self.api_key, self.api_secret = cloud_name, api_key, api_secret

    def sign(self, params: dict[str, str]) -> str:
        to_sign = "&".join(f"{k}={params[k]}" for k in sorted(params))
        # Cloudinary's default signature scheme is SHA-1 over the sorted params + secret (their API, not our choice).
        return hashlib.sha1((to_sign + self.api_secret).encode()).hexdigest()  # noqa: S324

    def upload_params(self, owner_id: uuid.UUID, purpose: Purpose) -> dict:
        key = new_key(owner_id, purpose)
        signed = {"public_id": key, "timestamp": str(int(time.time())), "allowed_formats": ALLOWED_FORMATS}
        if purpose in PRIVATE_PURPOSES:
            signed["type"] = "private"  # part of the signature, so a client can't upload it publicly
        return {
            "upload_url": f"https://api.cloudinary.com/v1_1/{self.cloud_name}/image/upload",
            "fields": {**signed, "api_key": self.api_key, "signature": self.sign(signed)},
            "key": key,
        }

    def url(self, key: str, variant: Variant) -> str:
        return f"https://res.cloudinary.com/{self.cloud_name}/image/upload/{self.TRANSFORMS[variant]}/{key}"

    def private_url(self, key: str, expires_in: int = 300) -> str:
        # Cloudinary "download" endpoint for private assets (the SDK's private_download_url).
        now = int(time.time())
        params = {
            "public_id": key,
            "format": "jpg",
            "type": "private",
            "timestamp": str(now),
            "expires_at": str(now + expires_in),
        }
        query = urlencode({**params, "api_key": self.api_key, "signature": self.sign(params)})
        return f"https://api.cloudinary.com/v1_1/{self.cloud_name}/image/download?{query}"

    async def delete(self, key: str, private: bool = False) -> None:
        signed = {"public_id": key, "timestamp": str(int(time.time()))}
        if private:
            signed["type"] = "private"
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.post(
                    f"https://api.cloudinary.com/v1_1/{self.cloud_name}/image/destroy",
                    data={**signed, "api_key": self.api_key, "signature": self.sign(signed)},
                )
            if response.status_code != 200:
                logger.warning("Cloudinary destroy %s failed (%s): %s", key, response.status_code, response.text)
        except httpx.HTTPError as exc:
            logger.warning("Cloudinary destroy %s failed: %s", key, exc)


@lru_cache
def r2_client(account_id: str, access_key_id: str, secret_access_key: str) -> BaseClient:
    """One boto3 client per credential set: building one per request costs more than the presign itself."""
    return boto3.client(
        "s3",
        endpoint_url=f"https://{account_id}.r2.cloudflarestorage.com",
        aws_access_key_id=access_key_id,
        aws_secret_access_key=secret_access_key,
        region_name="auto",
        config=Config(signature_version="s3v4", connect_timeout=5, read_timeout=10, retries={"max_attempts": 2}),
    )


class R2Storage(ImageStorage):
    """Cloudflare R2 over its S3 API: https://developers.cloudflare.com/r2/api/s3/presigned-urls/

    R2 has no form uploads, so the app PUTs the file to a presigned URL. R2 has no resizing either, so every
    variant is the uploaded original (the app already shrinks photos to 2048px). Identity documents go to a
    separate bucket with no public access and are read only through short-lived presigned GETs.
    """

    CONTENT_TYPE: ClassVar[str] = "image/jpeg"  # the app always uploads JPEG; signed, so other types are refused
    UPLOAD_TTL_SECONDS: ClassVar[int] = 900

    def __init__(self, client: BaseClient, bucket: str, private_bucket: str, public_url: str):
        self.client, self.bucket, self.private_bucket = client, bucket, private_bucket
        self.public_url = public_url.rstrip("/")

    def _bucket(self, private: bool) -> str:
        return self.private_bucket if private else self.bucket

    def upload_params(self, owner_id: uuid.UUID, purpose: Purpose) -> dict:
        key = new_key(owner_id, purpose)
        upload_url = self.client.generate_presigned_url(
            "put_object",
            Params={"Bucket": self._bucket(purpose in PRIVATE_PURPOSES), "Key": key, "ContentType": self.CONTENT_TYPE},
            ExpiresIn=self.UPLOAD_TTL_SECONDS,
        )
        return {
            "upload_url": upload_url,
            "method": "PUT",
            "fields": {},
            "headers": {"Content-Type": self.CONTENT_TYPE},
            "key": key,
        }

    def url(self, key: str, variant: Variant) -> str:
        return f"{self.public_url}/{key}"

    def private_url(self, key: str, expires_in: int = 300) -> str:
        return self.client.generate_presigned_url(
            "get_object", Params={"Bucket": self.private_bucket, "Key": key}, ExpiresIn=expires_in
        )

    async def delete(self, key: str, private: bool = False) -> None:
        try:
            await run_in_threadpool(self.client.delete_object, Bucket=self._bucket(private), Key=key)
        except (BotoCoreError, ClientError) as exc:
            logger.warning("R2 delete %s failed: %s", key, exc)


def get_storage() -> ImageStorage:
    s = get_upload_settings()
    if s.storage_provider == "fake":
        return FakeStorage()
    if s.storage_provider == "cloudinary":
        return CloudinaryStorage(
            s.cloudinary_cloud_name, s.cloudinary_api_key, s.cloudinary_api_secret.get_secret_value()
        )
    if s.storage_provider == "r2":
        client = r2_client(s.r2_account_id, s.r2_access_key_id, s.r2_secret_access_key.get_secret_value())
        return R2Storage(client, s.r2_bucket, s.r2_private_bucket, s.r2_public_url)
    raise ValueError(f"Unknown STORAGE_PROVIDER: {s.storage_provider!r} (supported: fake, cloudinary, r2)")
