"""Support contracts. The requester and the admin console share one ticket shape."""

import uuid
from datetime import datetime
from typing import Annotated

from pydantic import StringConstraints

from app.shared.schemas import APIModel
from app.support.constants import (
    DETAILS_MAX,
    MESSAGE_MAX,
    REPLY_MAX,
    Author,
    RequesterSide,
    TicketPriority,
    TicketStatus,
    Topic,
)

Text = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class ReportIn(APIModel):
    topic: Topic
    issue: Annotated[str, StringConstraints(max_length=30)]
    booking_id: uuid.UUID | None = None
    details: Annotated[str, StringConstraints(strip_whitespace=True, max_length=DETAILS_MAX)] | None = None


class AdminReportIn(APIModel):
    """An admin logging a phone request on someone's behalf."""

    phone: Annotated[str, StringConstraints(strip_whitespace=True, min_length=8, max_length=20)]
    topic: Topic
    issue: Annotated[str, StringConstraints(max_length=30)]
    booking_id: uuid.UUID | None = None
    message: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=REPLY_MAX)]


class MessageIn(APIModel):
    text: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=MESSAGE_MAX)]


class ReplyIn(APIModel):
    text: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=REPLY_MAX)]


class TicketPatch(APIModel):
    priority: TicketPriority | None = None
    status: TicketStatus | None = None


class Person(APIModel):
    id: uuid.UUID
    name: str


class Requester(Person):
    phone: str
    side: RequesterSide


class TicketBooking(APIModel):
    id: uuid.UUID
    code: str
    service_name: str
    artist_name: str


class MessageOut(APIModel):
    id: uuid.UUID
    author: Author
    author_name: str
    text: str
    created_at: datetime


class TicketOut(APIModel):
    id: uuid.UUID
    code: str
    subject: str
    topic: Topic
    issue: str
    status: TicketStatus
    priority: TicketPriority
    channel: str
    requester: Requester
    assignee: Person | None
    booking: TicketBooking | None
    created_at: datetime
    waiting_since: datetime | None  # the requester's last message, while it awaits support
    messages: list[MessageOut]  # empty in lists


class TicketPage(APIModel):
    items: list[TicketOut]
    next_cursor: str | None


class QueueCounts(APIModel):
    open: int
    mine: int
    artists: int
    customers: int
    urgent: int
    resolved: int


class SupportSummary(APIModel):
    counts: QueueCounts
    first_response_minutes: float | None  # median over the last 30 days
    resolved_7d: int
