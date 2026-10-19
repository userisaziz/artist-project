"""One conversation per customer–artist pair, and its messages. Each side keeps its own read mark."""

import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy import DateTime, Enum, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.chat.constants import MESSAGE_MAX_LENGTH, ChatSide, MessageModeration
from app.shared.models import Base, TimestampMixin

chat_side_enum = Enum(ChatSide, name="chat_side", values_callable=lambda e: [m.value for m in e])
moderation_enum = Enum(
    MessageModeration, name="chat_message_moderation", values_callable=lambda e: [m.value for m in e]
)


class Conversation(Base, TimestampMixin):
    """`last_message_at` stays NULL until the first message: empty chats never show in an inbox."""

    __tablename__ = "chat_conversation"
    __mapper_args__ = {"eager_defaults": True}

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
    )
    customer_id: Mapped[uuid.UUID] = mapped_column(  # lookups use uq_chat_conversation_pair, which leads with it
        UUID(as_uuid=True), ForeignKey("user_account.id"), nullable=False
    )
    artist_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("artist_profile.id"), nullable=False, index=True
    )
    last_message_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    customer_read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    artist_read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    __table_args__ = (
        sa.UniqueConstraint("customer_id", "artist_id", name="uq_chat_conversation_pair"),
        # Each side's inbox: its conversations with a message, in keyset order (last_message_at, id).
        sa.Index(
            "ix_chat_conversation_customer_inbox",
            "customer_id",
            "last_message_at",
            "id",
            postgresql_where=sa.text("last_message_at IS NOT NULL"),
        ),
        sa.Index(
            "ix_chat_conversation_artist_inbox",
            "artist_id",
            "last_message_at",
            "id",
            postgresql_where=sa.text("last_message_at IS NOT NULL"),
        ),
    )


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
    # Set only when the contact filter caught the message (see MessageModeration).
    moderation: Mapped[MessageModeration | None] = mapped_column(moderation_enum)
    flag: Mapped[str | None] = mapped_column(String(20))  # app.review.filters.review_flag: contact_info, blocked_word
    moderated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    moderated_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("user_account.id", ondelete="SET NULL")
    )

    __table_args__ = (
        sa.Index("ix_chat_message_conversation_created", "conversation_id", "created_at", "id"),
        sa.Index(
            "ix_chat_message_moderation_created",
            "moderation",
            "created_at",
            "id",
            postgresql_where=sa.text("moderation IS NOT NULL"),
        ),
    )
