"""Support tickets (one problem, reported in the app or logged by an admin for a phone request) and their
message thread."""

import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy import DateTime, Enum, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.shared.models import Base, TimestampMixin
from app.support.constants import REPLY_MAX, TicketPriority, TicketStatus

ticket_status_enum = Enum(TicketStatus, name="support_ticket_status", values_callable=lambda e: [m.value for m in e])
ticket_priority_enum = Enum(
    TicketPriority, name="support_ticket_priority", values_callable=lambda e: [m.value for m in e]
)


class Ticket(Base, TimestampMixin):
    __tablename__ = "support_ticket"
    __mapper_args__ = {"eager_defaults": True}

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
    )
    code: Mapped[str] = mapped_column(String(12), unique=True, nullable=False)  # e.g. T-7F3K2Q
    requester_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("user_account.id", ondelete="CASCADE"), nullable=False, index=True
    )
    requester_side: Mapped[str] = mapped_column(String(10), nullable=False)  # customer | artist
    topic: Mapped[str] = mapped_column(String(10), nullable=False)
    issue: Mapped[str] = mapped_column(String(30), nullable=False)
    booking_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("booking.id", ondelete="SET NULL")
    )
    channel: Mapped[str] = mapped_column(String(10), nullable=False)  # app | phone
    status: Mapped[TicketStatus] = mapped_column(ticket_status_enum, nullable=False, index=True)
    priority: Mapped[TicketPriority] = mapped_column(ticket_priority_enum, nullable=False)
    assignee_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("user_account.id", ondelete="SET NULL"), index=True
    )
    last_requester_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    first_response_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    __table_args__ = (sa.Index("ix_support_ticket_last_requester", "last_requester_at", "id"),)


class TicketMessage(Base):
    __tablename__ = "support_message"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
    )
    ticket_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("support_ticket.id", ondelete="CASCADE"), nullable=False
    )
    author: Mapped[str] = mapped_column(String(10), nullable=False)  # requester | support
    author_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("user_account.id", ondelete="SET NULL")
    )
    text: Mapped[str] = mapped_column(String(REPLY_MAX), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    __table_args__ = (sa.Index("ix_support_message_ticket_created", "ticket_id", "created_at"),)
