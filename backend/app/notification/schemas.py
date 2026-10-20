import uuid
from datetime import datetime
from typing import Annotated, Literal

from pydantic import Field, StringConstraints

from app.notification.constants import TOKEN_MAX
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
