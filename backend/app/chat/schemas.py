"""Chat contracts. Every response is from the reader's side: `counterpart` is the other party."""

import uuid
from datetime import datetime
from typing import Annotated

from pydantic import StringConstraints

from app.chat.constants import MESSAGE_MAX_LENGTH, ChatSide, MessageModeration
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
    moderation: MessageModeration | None  # only on the sender's own message: held (under review) or hidden


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


class EnquiryParty(APIModel):
    id: uuid.UUID  # user id for the customer, artist profile id for the artist
    name: str


class EnquiryOut(APIModel):
    """A message the contact filter caught, for the admin's Enquiries monitor."""

    id: uuid.UUID
    conversation_id: uuid.UUID
    sender: ChatSide
    text: str
    flag: str | None
    status: MessageModeration
    created_at: datetime
    moderated_at: datetime | None
    customer: EnquiryParty
    artist: EnquiryParty


class EnquiryPage(APIModel):
    items: list[EnquiryOut]  # newest first
    next_cursor: str | None


class EnquiryCounts(APIModel):
    held: int
    allowed: int
    hidden: int


class EnquirySummary(APIModel):
    counts: EnquiryCounts
    messages_7d: int  # customers' messages to artists in the last 7 days
    flagged_7d: int  # of those, caught by the filter
