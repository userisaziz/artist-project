import re

from pydantic import Field, field_validator

from app.shared.schemas import APIModel
from app.user.schemas import UserOut

PHONE_RE = re.compile(r"^\+[1-9]\d{6,14}$")  # E.164


class OTPRequest(APIModel):
    phone: str = Field(min_length=8, max_length=20)

    @field_validator("phone")
    @classmethod
    def e164(cls, v: str) -> str:
        if not PHONE_RE.match(v):
            raise ValueError("phone must be E.164 format, e.g. +15550001111")
        return v


class OTPVerify(OTPRequest):
    code: str = Field(pattern=r"^\d{6}$")


class RefreshRequest(APIModel):
    refresh_token: str


class TokenPair(APIModel):
    access_token: str
    refresh_token: str | None = Field(description="null when the token was set as the httpOnly cookie instead")
    token_type: str = "bearer"  # noqa: S105  (the OAuth token type, not a secret)
    user: UserOut
