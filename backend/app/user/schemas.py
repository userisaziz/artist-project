import uuid
from datetime import date, datetime
from typing import Annotated, Literal, Self

from pydantic import EmailStr, Field, StringConstraints, field_validator, model_validator

from app.shared.enums import UserRole
from app.shared.schemas import APIModel, ORMModel
from app.user.constants import ADDRESS_LABEL_MAX_LENGTH, ADDRESS_MAX_LENGTH, ADDRESS_MIN_LENGTH

AddressLabel = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=ADDRESS_LABEL_MAX_LENGTH)
]
AddressText = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=ADDRESS_MIN_LENGTH, max_length=ADDRESS_MAX_LENGTH)
]


class UserOut(ORMModel):
    id: uuid.UUID
    phone: str
    roles: list[UserRole]  # every role the account holds, e.g. ["customer", "artist", "admin"]
    active_role: Literal["customer", "artist"] | None  # the mobile side being shown; None until Choose role
    is_phone_verified: bool
    is_onboarded: bool  # = active_role is not None
    first_name: str | None = None
    last_name: str | None = None
    date_of_birth: date | None = None
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
    # Required here and never optional again: PATCH /users/me is the same call from Edit profile, so the
    # screen pre-fills it from the account. Being of age is checked in the service, which owns the clock.
    date_of_birth: date
    email: EmailStr | None = Field(default=None, max_length=255)
    whatsapp_booking_updates: bool = True

    @field_validator("date_of_birth")
    @classmethod
    def not_in_the_future(cls, value: date) -> date:
        if value > date.today():
            raise ValueError("Date of birth cannot be in the future")
        return value


class RoleChoice(APIModel):
    """Choose role / switch side: adds the role if new, then makes it active. Admin is never self-assigned."""

    role: Literal["customer", "artist"]


class AddressIn(APIModel):
    """Save an address. Lengths count after trimming surrounding spaces."""

    label: AddressLabel
    address: AddressText


class AddressPatch(APIModel):
    """Change the label, the address text, or both."""

    label: AddressLabel | None = None
    address: AddressText | None = None

    @model_validator(mode="after")
    def _something_to_change(self) -> Self:
        if self.label is None and self.address is None:
            raise ValueError("Send a label or an address")
        return self


class AddressOut(ORMModel):
    id: uuid.UUID
    label: str
    address: str
    created_at: datetime
    last_used_at: datetime | None
