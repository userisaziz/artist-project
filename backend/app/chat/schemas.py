"""Chat contracts. Every response is from the reader's side: `counterpart` is the other party."""

import uuid
from datetime import datetime
from typing import Annotated

from pydantic import StringConstraints

from app.chat.constants import MESSAGE_MAX_LENGTH, ChatSide
from app.shared.enums import BookingStatus
from app.shared.schemas import APIModel


class OpenWithArtistIn(APIModel):
    artist_id: uuid.UUID


class OpenFromBookingIn(APIModel):
    booking_id: uuid.UUID


class MessageIn(APIModel):
    text: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=MESSAGE_MAX_LENGTH)]


class MessageOut(APIModel):
    id: uuid.UUID
    sender: ChatSide
    text: str
    created_at: datetime


class MessagePage(APIModel):
    items: list[MessageOut]  # newest first
    next_cursor: str | None


class Counterpart(APIModel):
    id: uuid.UUID  # artist profile id for customers, user id for artists
    name: str
    photo_url: str | None


class LastMessage(APIModel):
    sender: ChatSide
    text: str
    created_at: datetime


class ConversationBooking(APIModel):
    """The booking that matters most between the two: the next live one, else the latest."""

    id: uuid.UUID
    code: str
    status: BookingStatus
    service_name: str
    start_at: datetime


class ConversationOut(APIModel):
    id: uuid.UUID
    counterpart: Counterpart
    last_message: LastMessage | None
    unread_count: int
    booking: ConversationBooking | None


class ConversationPage(APIModel):
    items: list[ConversationOut]
    next_cursor: str | None
