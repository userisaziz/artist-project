import uuid
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.utils.enums import UserRole


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    phone: str
    role: UserRole
    is_phone_verified: bool
    is_onboarded: bool
    first_name: str | None = None
    last_name: str | None = None
    email: str | None = None
    avatar_url: str | None = None
    whatsapp_booking_updates: bool


class AccountDetails(BaseModel):
    """Sign-up step: who the user is (before Choose role)."""

    first_name: str = Field(min_length=1, max_length=100)
    last_name: str | None = Field(default=None, max_length=100)
    email: str | None = Field(default=None, max_length=255)
    whatsapp_booking_updates: bool = True


class RoleChoice(BaseModel):
    """Choose role step; admin is never self-assigned."""

    role: Literal["customer", "artist"]
