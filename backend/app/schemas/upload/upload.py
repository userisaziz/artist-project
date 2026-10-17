"""Signed direct-upload contracts: the app uploads straight to the image host, then sends us the key."""

from typing import Literal

from pydantic import BaseModel


class UploadRequest(BaseModel):
    purpose: Literal["artist_photo", "portfolio", "aadhaar"]


class UploadOut(BaseModel):
    """POST `fields` plus the image (form field `file`) to `upload_url`, then send `key` to our API."""

    upload_url: str
    fields: dict[str, str]
    key: str
