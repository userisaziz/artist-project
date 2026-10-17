import uuid
from typing import Literal

from pydantic import EmailStr, Field, field_validator

from app.shared.enums import UserRole
from app.shared.schemas import APIModel, ORMModel


class UserOut(ORMModel):
    id: uuid.UUID
    phone: str
    roles: list[UserRole]  # every role the account holds, e.g. ["customer", "artist", "admin"]
    active_role: Literal["customer", "artist"] | None  # the mobile side being shown; None until Choose role
    is_phone_verified: bool
    is_onboarded: bool  # = active_role is not None
    first_name: str | None = None
    last_name: str | None = None
    email: str | None = None
    avatar_url: str | None = None
    whatsapp_booking_updates: bool

    @field_validator("roles", mode="before")
    @classmethod
    def ordered(cls, roles):
        order = list(UserRole)
        return sorted(roles, key=order.index)


class AccountDetails(APIModel):
    """Sign-up step: who the user is (before Choose role)."""

    first_name: str = Field(min_length=1, max_length=100)
    last_name: str | None = Field(default=None, max_length=100)
    email: EmailStr | None = Field(default=None, max_length=255)
    whatsapp_booking_updates: bool = True


class RoleChoice(APIModel):
    """Choose role / switch side: adds the role if new, then makes it active. Admin is never self-assigned."""

    role: Literal["customer", "artist"]
