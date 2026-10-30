import uuid
from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import Field, StringConstraints, model_validator

from app.notification.constants import BODY_MAX, LINK_MAX, TITLE_MAX, TOKEN_MAX
from app.shared.schemas import APIModel


class NotificationOut(APIModel):
    id: uuid.UUID
    kind: str
    title: str
    body: str
    link: str | None
    read_at: datetime | None
    created_at: datetime


class NotificationPage(APIModel):
    items: list[NotificationOut]
    next_cursor: str | None


class UnreadCount(APIModel):
    count: int


class ReadIn(APIModel):
    ids: list[uuid.UUID] | None = Field(default=None, max_length=200)  # None: everything


class DeviceIn(APIModel):
    token: Annotated[str, StringConstraints(strip_whitespace=True, min_length=10, max_length=TOKEN_MAX)]
    platform: Literal["ios", "android", "web"]


class BroadcastFilters(APIModel):
    city: Annotated[str | None, StringConstraints(max_length=60)] = None
    artist_status: Literal["draft", "pending", "approved"] | None = None
    category_id: int | None = None
    joined_from: date | None = None
    joined_to: date | None = None

    @model_validator(mode="after")
    def range_is_valid(self):
        if self.joined_from and self.joined_to and self.joined_from > self.joined_to:
            raise ValueError("joined_from must be on or before joined_to")
        return self


class BroadcastPreviewIn(APIModel):
    segment: Literal["all_users", "all_artists", "all_customers"]
    filters: BroadcastFilters = Field(default_factory=BroadcastFilters)


class BroadcastPreviewOut(APIModel):
    recipients: int
    with_push: int


class BroadcastIn(BroadcastPreviewIn):
    title: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=TITLE_MAX)]
    body: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=BODY_MAX)]
    link: Annotated[str | None, StringConstraints(max_length=LINK_MAX, pattern=r"^/(?:[^/]|$)")] = None


class BroadcastSentOut(APIModel):
    id: uuid.UUID
    recipients: int
    with_push: int


class BroadcastOut(APIModel):
    id: uuid.UUID
    title: str
    body: str
    link: str | None
    segment: str
    filters: dict
    recipient_count: int
    push_count: int
    created_at: datetime


class BroadcastPage(APIModel):
    items: list[BroadcastOut]
    next_cursor: str | None
