"""Signed direct-upload contracts: the app uploads straight to the image host, then sends us the key."""

from typing import Literal

from pydantic import Field

from app.shared.schemas import APIModel


class UploadRequest(APIModel):
    purpose: Literal["artist_photo", "portfolio", "aadhaar", "post", "shop", "service"]


class UploadOut(APIModel):
    """Send the image to `upload_url`, then send `key` to our API.

    POST: a multipart form of `fields` plus the image as `file` (Cloudinary).
    PUT: the raw image as the body, with `headers` (R2 presigned URL; `fields` is empty).
    """

    upload_url: str
    method: Literal["POST", "PUT"] = "POST"
    fields: dict[str, str]
    headers: dict[str, str] = Field(default_factory=dict)
    key: str
