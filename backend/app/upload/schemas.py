"""Signed direct-upload contracts: the app uploads straight to the image host, then sends us the key."""

from typing import Literal

from app.shared.schemas import APIModel


class UploadRequest(APIModel):
    purpose: Literal["artist_photo", "portfolio", "aadhaar", "post", "shop"]


class UploadOut(APIModel):
    """POST `fields` plus the image (form field `file`) to `upload_url`, then send `key` to our API."""

    upload_url: str
    fields: dict[str, str]
    key: str
