"""Chat: customers message approved artists; artists reply, or open a chat with a customer who booked them.
Delivery is by polling: clients re-read the inbox and the open conversation on an interval."""

import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any, cast

from sqlalchemy import ColumnElement
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.chat.constants import REPLY_TIME_MIN_REPLIES, ChatSide, MessageModeration
from app.chat.models import Conversation, Message
from app.chat.repository import ChatRepository, ConversationRow, customer_name_matches
from app.core.exceptions import ConflictError, NotFoundError
from app.notification import service as notification_service
from app.review import filters as review_filters
from app.shared.clock import Clock
from app.shared.enums import BookingStatus
from app.shared.pagination import split_page
from app.shared.search import like_pattern
from app.upload.service import ImageStorage

CUSTOMER_FALLBACK_NAME = "Atelier customer"
TICK = timedelta(microseconds=1)
# Bookings an artist may start a chat from: live requests, confirmed and completed work. Not declined,
# cancelled or expired ones, so a customer who walked away isn't contacted again.
CHAT_BOOKING_STATUSES = (BookingStatus.requested, BookingStatus.confirmed, BookingStatus.completed)


@dataclass(frozen=True)
class Participant:
    """The reader: a customer (`id` = user id) or an approved artist (`id` = artist profile id)."""

    side: ChatSide
    id: uuid.UUID

    @property
    def scope(self) -> ColumnElement[bool]:
        """Only conversations this participant is part of."""
        if self.side == ChatSide.customer:
            return Conversation.customer_id == self.id
        return Conversation.artist_id == self.id


async def reply_minutes(session: AsyncSession, artist_id: uuid.UUID) -> int | None:
    """The artist's median reply time in whole minutes; None until they've replied often enough to tell."""
    median, replies = await ChatRepository(session).reply_minutes(artist_id)
    if median is None or replies < REPLY_TIME_MIN_REPLIES:
        return None
    return round(median)


def customer_name(first: str | None, last: str | None) -> str:
    return " ".join(n for n in (first, last) if n) or CUSTOMER_FALLBACK_NAME


def message_out(m: Message) -> dict[str, Any]:
    """`moderation` is shown only while it matters to the sender: held or hidden. Allowed reads as normal."""
    pending = m.moderation if m.moderation in (MessageModeration.held, MessageModeration.hidden) else None
    return {"id": m.id, "sender": m.sender, "text": m.text, "created_at": m.created_at, "moderation": pending}


def conversation_out(row: ConversationRow, side: ChatSide, storage: ImageStorage) -> dict[str, Any]:
    c = row.conversation
    if side == ChatSide.customer:
        photo = storage.url(row.photo_key, "thumb") if row.photo_key else None
        counterpart = {"id": c.artist_id, "name": row.business_name, "photo_url": photo}
    else:
        name = customer_name(row.first_name, row.last_name)
        counterpart = {"id": c.customer_id, "name": name, "photo_url": row.avatar_url}
    last = (
        {"sender": row.last_sender, "text": row.last_text, "created_at": row.last_created_at}
        if row.last_sender
        else None
    )
    booking = (
        {
            "id": row.booking_id,
            "code": row.booking_code,
            "status": row.booking_status,
            "service_name": row.booking_service_name,
            "start_at": row.booking_start_at,
        }
        if row.booking_id
        else None
    )
    return {
        "id": c.id,
        "counterpart": counterpart,
        "last_message": last,
        "unread_count": row.unread_count,
        "booking": booking,
    }


class ChatService:
    def __init__(self, session: AsyncSession, storage: ImageStorage, clock: Clock):
        self.session = session
        self.chats = ChatRepository(session)
        self.storage = storage
        self.clock = clock

    async def _out(self, participant: Participant, conversation_id: uuid.UUID) -> dict[str, Any]:
        row = await self.chats.row(participant.side, self.clock.now(), conversation_id)
        return conversation_out(row, participant.side, self.storage)

    async def _open(self, participant: Participant, customer_id: uuid.UUID, artist_id: uuid.UUID) -> dict[str, Any]:
        """Get or create the pair's conversation. Two opens at once: the unique pair decides, the loser re-reads."""
        conversation = await self.chats.pair(customer_id, artist_id)
        if conversation is None:
            self.chats.add(Conversation(customer_id=customer_id, artist_id=artist_id))
            try:
                await self.session.commit()
            except IntegrityError:
                await self.session.rollback()
            conversation = await self.chats.pair(customer_id, artist_id)
            if conversation is None:  # lost the race and the winner rolled back: let the client retry
                raise ConflictError("Couldn't open the conversation. Please try again.")
        return await self._out(participant, conversation.id)

    async def conversation(self, participant: Participant, conversation_id: uuid.UUID) -> Conversation:
        """One of the participant's conversations; anyone else's reads as 404."""
        conversation = await self.chats.scoped(conversation_id, participant.scope)
        if conversation is None:
            raise NotFoundError("Conversation not found")
        return conversation

    async def get(self, participant: Participant, conversation: Conversation) -> dict[str, Any]:
        return await self._out(participant, conversation.id)

    async def open_with_artist(self, participant: Participant, artist_id: uuid.UUID) -> dict[str, Any]:
        owner = await self.chats.approved_artist_owner(artist_id)
        if owner is None:
            raise NotFoundError("Artist not found")
        if owner == participant.id:
            raise ConflictError("You can't message your own profile")
        return await self._open(participant, participant.id, artist_id)

    async def open_from_booking(self, participant: Participant, booking_id: uuid.UUID) -> dict[str, Any]:
        booking = await self.chats.artist_booking(booking_id, participant.id)
        if booking is None:
            raise NotFoundError("Booking not found")
        expired = booking.status == BookingStatus.requested and booking.expires_at <= self.clock.now()
        if booking.status not in CHAT_BOOKING_STATUSES or expired:
            raise ConflictError("You can message customers about live or completed bookings only")
        return await self._open(participant, booking.customer_id, participant.id)

    async def inbox(self, participant: Participant, q: str | None, limit: int, cursor: str | None):
        where = [participant.scope]
        if q and q.strip() and participant.side == ChatSide.artist:
            where.append(customer_name_matches(like_pattern(q)))
        rows = await self.chats.page_rows(participant.side, self.clock.now(), where, limit=limit, cursor=cursor)
        # page_rows only returns conversations with a message, so last_message_at is set.
        page, next_cursor = split_page(
            rows, limit, lambda r: (cast(datetime, r.conversation.last_message_at), r.conversation.id)
        )
        return [conversation_out(r, participant.side, self.storage) for r in page], next_cursor

    async def messages(self, participant: Participant, conversation: Conversation, limit: int, cursor: str | None):
        rows = await self.chats.message_page(conversation.id, participant.side, limit=limit, cursor=cursor)
        page, next_cursor = split_page(rows, limit, lambda m: (m.created_at, m.id))
        return [message_out(m) for m in page], next_cursor

    async def send(self, participant: Participant, conversation: Conversation, text: str) -> dict[str, Any]:
        """Under the conversation's row lock, so message times strictly increase in commit order and a read
        mark taken after a send always covers it. Writing counts as reading for the sender.
        A message the contact filter catches is saved but held: only the sender sees it until an admin decides."""
        flag = review_filters.review_flag(text)
        if participant.side == ChatSide.customer and not await self.chats.approved_artist_owner(conversation.artist_id):
            raise ConflictError("This artist isn't taking messages right now")
        locked = await self.chats.locked(conversation.id)
        at = self._next_time(locked.last_message_at)
        message = Message(
            conversation_id=locked.id,
            sender=participant.side,
            text=text,
            created_at=at,
            flag=flag,
            moderation=MessageModeration.held if flag else None,
        )
        self.chats.add(message)
        if not flag:
            await self._notify(participant, locked, text)
        locked.last_message_at = at
        self._mark_read(participant, locked, at)
        await self.session.commit()
        return message_out(message)

    async def mark_read(self, participant: Participant, conversation: Conversation) -> dict[str, Any]:
        locked = await self.chats.locked(conversation.id)
        self._mark_read(participant, locked, self.clock.now())
        await self.session.commit()
        return await self._out(participant, conversation.id)

    async def _notify(self, participant: Participant, conversation: Conversation, text: str) -> None:
        """Only when the other side had caught up: one notification per burst of unread messages."""
        to_artist = participant.side == ChatSide.customer
        their_read = conversation.artist_read_at if to_artist else conversation.customer_read_at
        last = conversation.last_message_at
        if last is not None and (their_read is None or their_read < last):
            return
        title, body = "New message", text[:120]
        if to_artist:
            link = f"/artist/chat/{conversation.id}"
            await notification_service.notify_artist(
                self.session, conversation.artist_id, "chat_message", title, body, link
            )
        else:
            link = f"/customer/chat/{conversation.id}"
            await notification_service.notify(self.session, conversation.customer_id, "chat_message", title, body, link)

    def _next_time(self, last: datetime | None) -> datetime:
        """Now, or just after the previous message if the clock hasn't moved past it."""
        now = self.clock.now()
        return now if last is None or now > last else last + TICK

    @staticmethod
    def _mark_read(participant: Participant, conversation: Conversation, at: datetime) -> None:
        """Read marks only move forward."""
        field = "customer_read_at" if participant.side == ChatSide.customer else "artist_read_at"
        current = getattr(conversation, field)
        setattr(conversation, field, at if current is None or at > current else current)
