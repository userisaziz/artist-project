from datetime import datetime

from pydantic import Field

from app.requirement.constants import MAX_GRACE_DAYS, MIN_GRACE_DAYS
from app.shared.schemas import APIModel


class RequirementSettingIn(APIModel):
    mandatory: bool
    grace_days: int = Field(ge=MIN_GRACE_DAYS, le=MAX_GRACE_DAYS)


class RequirementSettingOut(APIModel):
    key: str
    title: str
    body: str
    mandatory: bool
    grace_days: int
    effective_from: datetime | None  # when it became mandatory; None while optional


class PendingRequirement(APIModel):
    key: str
    title: str
    body: str
    action: str  # artist-app path that completes it
    due_at: datetime  # after this the artist is on hold
    overdue: bool


class MyRequirements(APIModel):
    on_hold: bool  # hidden from customers and taking no new bookings until every overdue item is done
    items: list[PendingRequirement]
