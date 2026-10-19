"""Admin settings contracts, phase 1: read-only booking rules, live cities, team access."""

import uuid
from datetime import datetime
from typing import Annotated

from pydantic import StringConstraints

from app.shared.schemas import APIModel

E164 = r"^\+[1-9]\d{6,14}$"


class Policy(APIModel):
    key: str
    label: str
    value: str
    scope: str
    editable: bool  # False in phase 1: these are set in server config


class City(APIModel):
    name: str
    artists: int  # approved artists in the city
    bookings_30d: int


class TeamMember(APIModel):
    id: uuid.UUID
    name: str
    phone: str
    email: str | None
    admin_since: datetime
    is_me: bool


class AddAdminIn(APIModel):
    phone: Annotated[str, StringConstraints(strip_whitespace=True, pattern=E164)]
