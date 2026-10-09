import re

from pydantic import BaseModel, Field, field_validator

from app.schemas.user import UserOut

PHONE_RE = re.compile(r"^\+[1-9]\d{6,14}$")  # E.164


class OTPRequest(BaseModel):
    phone: str = Field(min_length=8, max_length=20)

    @field_validator("phone")
    @classmethod
    def e164(cls, v: str) -> str:
        if not PHONE_RE.match(v):
            raise ValueError("phone must be E.164 format, e.g. +15550001111")
        return v


class OTPVerify(OTPRequest):
    code: str = Field(pattern=r"^\d{6}$")


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserOut
