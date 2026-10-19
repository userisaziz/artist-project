"""Queries over conversations and messages. The inbox row (last message, unread count, booking tag)
is assembled in SQL with lateral subqueries; read rules and shaping stay in the service."""

import uuid
from collections.abc import Sequence
from datetime import datetime
from typing import NamedTuple

from sqlalchemy import ColumnElement, Select, and_, case, func, or_, select, true
from sqlalchemy.ext.asyncio import AsyncSession

from app.artist.models import ArtistProfile
from app.booking.models import Booking
from app.chat.constants import ChatSide, MessageModeration
from app.chat.models import Conversation, Message
from app.shared.enums import ArtistStatus, BookingStatus
from app.shared.pagination import keyset
from app.user.models import User


class ConversationRow(NamedTuple):
    conversation: Conversation
    business_name: str
    photo_key: str | None
    first_name: str | None
    last_name: str | None
    avatar_url: str | None
    last_sender: ChatSide | None
    last_text: str | None
    last_created_at: datetime | None
    unread_count: int
    booking_id: uuid.UUID | None
    booking_code: str | None
    booking_status: BookingStatus | None
    booking_service_name: str | None
    booking_start_at: datetime | None


def visible_to(side: ChatSide) -> ColumnElement[bool]:
    """The sender sees all their own messages; the other side never sees one that is held or hidden."""
    return or_(Message.sender == side, Message.moderation.is_(None), Message.moderation == MessageModeration.allowed)


def rows_query(side: ChatSide, now: datetime, *, with_message: bool = False) -> Select:
    """A conversation with both parties' names, its last message, the reader's unread count and the booking tag.
    `with_message`: only conversations with at least one message this reader can see."""
    last = (
        select(Message.sender, Message.text, Message.created_at)
        .where(Message.conversation_id == Conversation.id, visible_to(side))
        .order_by(Message.created_at.desc(), Message.id.desc())
        .limit(1)
        .lateral("last_message")
    )
    read_at = Conversation.customer_read_at if side == ChatSide.customer else Conversation.artist_read_at
    unread = (
        select(func.count())
        .where(
            Message.conversation_id == Conversation.id,
            Message.sender != side,
            visible_to(side),
            or_(read_at.is_(None), Message.created_at > read_at),
        )
        .scalar_subquery()
    )
    live = or_(
        and_(Booking.status == BookingStatus.confirmed, Booking.start_at >= now),
        and_(Booking.status == BookingStatus.requested, Booking.expires_at > now),
    )
    booking = (
        select(Booking.id, Booking.code, Booking.status, Booking.service_name, Booking.start_at)
        .where(Booking.customer_id == Conversation.customer_id, Booking.artist_id == Conversation.artist_id)
        .order_by(case((live, 0), else_=1), case((live, Booking.start_at)).asc(), Booking.start_at.desc())
        .limit(1)
        .lateral("tag_booking")
    )
    query = (
        select(
            Conversation,
            ArtistProfile.business_name,
            ArtistProfile.photo_key,
            User.first_name,
            User.last_name,
            User.avatar_url,
            last.c.sender,
            last.c.text,
            last.c.created_at,
            unread,
            booking.c.id,
            booking.c.code,
            booking.c.status,
            booking.c.service_name,
            booking.c.start_at,
        )
        .join(ArtistProfile, ArtistProfile.id == Conversation.artist_id)
        .join(User, User.id == Conversation.customer_id)
        .outerjoin(last, true())
        .outerjoin(booking, true())
    )
    return query.where(last.c.created_at.is_not(None)) if with_message else query


def customer_name_matches(pattern: str) -> ColumnElement[bool]:
    return func.concat_ws(" ", User.first_name, User.last_name).ilike(pattern, escape="\\")


class ChatRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def page_rows(
        self,
        side: ChatSide,
        now: datetime,
        where: Sequence[ColumnElement[bool]],
        *,
        limit: int,
        cursor: str | None,
    ) -> list[ConversationRow]:
        """Conversations with at least one message the reader can see, latest first; `limit + 1` rows so the
        caller can tell whether there is more. (Ordered by the latest message of either side, held ones included.)"""
        query = keyset(
            rows_query(side, now, with_message=True).where(Conversation.last_message_at.is_not(None), *where),
            Conversation.last_message_at,
            Conversation.id,
            descending=True,
            cursor=cursor,
        )
        return [ConversationRow(*r) for r in (await self.session.execute(query.limit(limit + 1))).all()]

    async def row(self, side: ChatSide, now: datetime, conversation_id: uuid.UUID) -> ConversationRow:
        return ConversationRow(
            *(await self.session.execute(rows_query(side, now).where(Conversation.id == conversation_id))).one()
        )

    async def scoped(self, conversation_id: uuid.UUID, scope: ColumnElement[bool]) -> Conversation | None:
        return await self.session.scalar(select(Conversation).where(Conversation.id == conversation_id, scope))

    async def pair(self, customer_id: uuid.UUID, artist_id: uuid.UUID) -> Conversation | None:
        return await self.session.scalar(
            select(Conversation).where(Conversation.customer_id == customer_id, Conversation.artist_id == artist_id)
        )

    async def approved_artist_owner(self, artist_id: uuid.UUID) -> uuid.UUID | None:
        """The user behind an approved artist profile; None for unknown or unapproved profiles."""
        return await self.session.scalar(
            select(ArtistProfile.user_id).where(
                ArtistProfile.id == artist_id, ArtistProfile.status == ArtistStatus.approved
            )
        )

    async def artist_booking(self, booking_id: uuid.UUID, artist_id: uuid.UUID) -> Booking | None:
        """One of this artist's bookings; None if the booking isn't theirs."""
        return await self.session.scalar(
            select(Booking).where(Booking.id == booking_id, Booking.artist_id == artist_id)
        )

    async def locked(self, conversation_id: uuid.UUID) -> Conversation:
        """SELECT … FOR UPDATE, refreshed: sends and read marks on one conversation take turns."""
        return (
            await self.session.execute(
                select(Conversation)
                .where(Conversation.id == conversation_id)
                .with_for_update()
                .execution_options(populate_existing=True)
            )
        ).scalar_one()

    async def message_page(
        self, conversation_id: uuid.UUID, side: ChatSide, *, limit: int, cursor: str | None
    ) -> list[Message]:
        """What `side` can see, newest first, keyset on (created_at, id), `limit + 1` rows."""
        query = keyset(
            select(Message).where(Message.conversation_id == conversation_id, visible_to(side)),
            Message.created_at,
            Message.id,
            descending=True,
            cursor=cursor,
        )
        return list((await self.session.scalars(query.limit(limit + 1))).all())

    def add(self, row: Conversation | Message) -> None:
        self.session.add(row)
