"""The admin's Enquiries monitor: messages the contact filter held back, and the allow / hide decision on each."""

import uuid
from datetime import timedelta
from typing import Any

from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.artist.models import ArtistProfile
from app.chat.constants import ENQUIRY_SUMMARY_DAYS, ChatSide, MessageModeration
from app.chat.models import Conversation, Message
from app.chat.service import customer_name
from app.core.exceptions import ConflictError, NotFoundError
from app.shared.clock import Clock
from app.shared.pagination import keyset, split_page
from app.user.models import User


def _enquiry_rows() -> Select:
    return (
        select(Message, ArtistProfile.id, ArtistProfile.business_name, User.id, User.first_name, User.last_name)
        .join(Conversation, Conversation.id == Message.conversation_id)
        .join(ArtistProfile, ArtistProfile.id == Conversation.artist_id)
        .join(User, User.id == Conversation.customer_id)
    )


def enquiry_out(row: Any) -> dict[str, Any]:
    m, artist_id, business_name, customer_id, first, last = row
    return {
        "id": m.id,
        "conversation_id": m.conversation_id,
        "sender": m.sender,
        "text": m.text,
        "flag": m.flag,
        "status": m.moderation,
        "created_at": m.created_at,
        "moderated_at": m.moderated_at,
        "customer": {"id": customer_id, "name": customer_name(first, last)},
        "artist": {"id": artist_id, "name": business_name},
    }


class EnquiryAdminService:
    def __init__(self, session: AsyncSession, clock: Clock):
        self.session = session
        self.clock = clock

    async def list(self, status: MessageModeration | None, limit: int, cursor: str | None):
        """Caught messages, newest first; `status` None means every caught message whatever the decision."""
        where = Message.moderation == status if status else Message.moderation.is_not(None)
        query = keyset(_enquiry_rows().where(where), Message.created_at, Message.id, descending=True, cursor=cursor)
        rows = (await self.session.execute(query.limit(limit + 1))).all()
        page, next_cursor = split_page(rows, limit, lambda r: (r[0].created_at, r[0].id))
        return [enquiry_out(r) for r in page], next_cursor

    async def summary(self) -> dict[str, Any]:
        counts = dict(
            (
                await self.session.execute(
                    select(Message.moderation, func.count())
                    .where(Message.moderation.is_not(None))
                    .group_by(Message.moderation)
                )
            ).all()
        )
        since = self.clock.now() - timedelta(days=ENQUIRY_SUMMARY_DAYS)
        recent = select(func.count()).where(Message.sender == ChatSide.customer, Message.created_at >= since)
        return {
            "counts": {m.value: counts.get(m, 0) for m in MessageModeration},
            "messages_7d": await self.session.scalar(recent),
            "flagged_7d": await self.session.scalar(recent.where(Message.moderation.is_not(None))),
        }

    async def decide(self, message_id: uuid.UUID, decision: MessageModeration, admin_id: uuid.UUID) -> dict[str, Any]:
        """Allow (deliver to the other side) or hide (never delivered) a held message. Decisions are final."""
        message = await self.session.scalar(select(Message).where(Message.id == message_id).with_for_update())
        if message is None or message.moderation is None:
            raise NotFoundError("Enquiry not found")
        if message.moderation != MessageModeration.held:
            raise ConflictError(f"This message was already {message.moderation.value}")
        message.moderation = decision
        message.moderated_at = self.clock.now()
        message.moderated_by_id = admin_id
        await self.session.commit()
        row = (await self.session.execute(_enquiry_rows().where(Message.id == message_id))).one()
        return enquiry_out(row)
