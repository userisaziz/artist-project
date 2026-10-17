"""Chat: customers message approved artists; artists reply, or open a chat with a customer who booked them.
Delivery is by polling: clients re-read the inbox and the open conversation on an interval."""

import uuid
from dataclasses import dataclass
from typing import Any

from sqlalchemy import ColumnElement
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.chat.constants import ChatSide
from app.chat.models import Conversation, Message
from app.chat.repository import ChatRepository, ConversationRow, customer_name_matches
from app.core.exceptions import ConflictError, NotFoundError
from app.shared.clock import Clock
from app.shared.pagination import split_page
from app.shared.search import like_pattern
from app.upload.service import ImageStorage

CUSTOMER_FALLBACK_NAME = "Atelier customer"


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


def customer_name(first: str | None, last: str | None) -> str:
    return " ".join(n for n in (first, last) if n) or CUSTOMER_FALLBACK_NAME


def message_out(m: Message) -> dict[str, Any]:
    return {"id": m.id, "sender": m.sender, "text": m.text, "created_at": m.created_at}


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
        return await self._out(participant, conversation.id)

    async def conversation(self, participant: Participant, conversation_id: uuid.UUID) -> Conversation:
        """One of the participant's conversations; anyone else's reads as 404."""
        conversation = await self.chats.scoped(conversation_id, participant.scope)
        if conversation is None:
            raise NotFoundError("Conversation not found")
        return conversation

    async def open_with_artist(self, participant: Participant, artist_id: uuid.UUID) -> dict[str, Any]:
        owner = await self.chats.approved_artist_owner(artist_id)
        if owner is None:
            raise NotFoundError("Artist not found")
        if owner == participant.id:
            raise ConflictError("You can't message your own profile")
        return await self._open(participant, participant.id, artist_id)

    async def open_from_booking(self, participant: Participant, booking_id: uuid.UUID) -> dict[str, Any]:
        customer_id = await self.chats.booking_customer(booking_id, participant.id)
        if customer_id is None:
            raise NotFoundError("Booking not found")
        return await self._open(participant, customer_id, participant.id)

    async def inbox(self, participant: Participant, q: str | None, limit: int, cursor: str | None):
        where = [participant.scope]
        if q and q.strip() and participant.side == ChatSide.artist:
            where.append(customer_name_matches(like_pattern(q)))
        rows = await self.chats.page_rows(participant.side, self.clock.now(), where, limit=limit, cursor=cursor)
        page, next_cursor = split_page(rows, limit, lambda r: (r.conversation.last_message_at, r.conversation.id))
        return [conversation_out(r, participant.side, self.storage) for r in page], next_cursor

    async def messages(self, conversation: Conversation, limit: int, cursor: str | None):
        rows = await self.chats.message_page(conversation.id, limit=limit, cursor=cursor)
        page, next_cursor = split_page(rows, limit, lambda m: (m.created_at, m.id))
        return [message_out(m) for m in page], next_cursor

    async def send(self, participant: Participant, conversation: Conversation, text: str) -> dict[str, Any]:
        """Writing counts as reading: the sender has seen everything up to their own message."""
        now = self.clock.now()
        message = Message(conversation_id=conversation.id, sender=participant.side, text=text, created_at=now)
        self.chats.add(message)
        conversation.last_message_at = now
        self._mark_read(participant, conversation)
        await self.session.commit()
        return message_out(message)

    async def mark_read(self, participant: Participant, conversation: Conversation) -> dict[str, Any]:
        self._mark_read(participant, conversation)
        await self.session.commit()
        return await self._out(participant, conversation.id)

    def _mark_read(self, participant: Participant, conversation: Conversation) -> None:
        if participant.side == ChatSide.customer:
            conversation.customer_read_at = self.clock.now()
        else:
            conversation.artist_read_at = self.clock.now()
