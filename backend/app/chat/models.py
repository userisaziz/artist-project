"""One conversation per customer–artist pair, and its messages. Each side keeps its own read mark."""

import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy import DateTime, Enum, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.chat.constants import MESSAGE_MAX_LENGTH, ChatSide
from app.shared.models import Base, TimestampMixin

chat_side_enum = Enum(ChatSide, name="chat_side", values_callable=lambda e: [m.value for m in e])


class Conversation(Base, TimestampMixin):
    """`last_message_at` stays NULL until the first message: empty chats never show in an inbox."""

    __tablename__ = "chat_conversation"
    __mapper_args__ = {"eager_defaults": True}

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
    )
    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("user_account.id"), nullable=False, index=True
    )
    artist_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("artist_profile.id"), nullable=False, index=True
    )
    last_message_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    customer_read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    artist_read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    __table_args__ = (sa.UniqueConstraint("customer_id", "artist_id", name="uq_chat_conversation_pair"),)


class Message(Base):
    __tablename__ = "chat_message"
    __mapper_args__ = {"eager_defaults": True}

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
    )
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("chat_conversation.id", ondelete="CASCADE"), nullable=False
    )
    sender: Mapped[ChatSide] = mapped_column(chat_side_enum, nullable=False)
    text: Mapped[str] = mapped_column(String(MESSAGE_MAX_LENGTH), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    __table_args__ = (sa.Index("ix_chat_message_conversation_created", "conversation_id", "created_at"),)
