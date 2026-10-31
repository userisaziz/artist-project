"""A person's notification inbox, and the devices their pushes go to."""

import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.notification.constants import BODY_MAX, LINK_MAX, TITLE_MAX, TOKEN_MAX
from app.shared.models import Base, TimestampMixin


class Notification(Base):
    __tablename__ = "notification"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("user_account.id", ondelete="CASCADE"), nullable=False
    )
    kind: Mapped[str] = mapped_column(String(30), nullable=False)
    title: Mapped[str] = mapped_column(String(TITLE_MAX), nullable=False)
    body: Mapped[str] = mapped_column(String(BODY_MAX), nullable=False)
    link: Mapped[str | None] = mapped_column(String(LINK_MAX))  # an app route, e.g. /customer/booking/<id>
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (sa.Index("ix_notification_user_created", "user_id", "created_at", "id"),)


class PushDevice(Base, TimestampMixin):
    """An Expo push token. A token belongs to one account at a time: signing in elsewhere moves it."""

    __tablename__ = "notification_push_device"

    token: Mapped[str] = mapped_column(String(TOKEN_MAX), primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("user_account.id", ondelete="CASCADE"), nullable=False, index=True
    )
    platform: Mapped[str] = mapped_column(String(10), nullable=False)


class NotificationBroadcast(Base, TimestampMixin):
    """One admin broadcast: what was sent, to whom (segment + filter snapshot), and the resulting counts.
    Immutable: no edits or deletes — the history table plus the admin.action audit is the trail."""

    __tablename__ = "notification_broadcast"
    __mapper_args__ = {"eager_defaults": True}  # fetch server defaults (id, timestamps) via RETURNING

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
    )
    title: Mapped[str] = mapped_column(String(TITLE_MAX), nullable=False)
    body: Mapped[str] = mapped_column(String(BODY_MAX), nullable=False)
    link: Mapped[str | None] = mapped_column(String(LINK_MAX))
    segment: Mapped[str] = mapped_column(String(20), nullable=False)  # all_users | all_artists | all_customers
    filters: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict, server_default=sa.text("'{}'"))
    recipient_count: Mapped[int] = mapped_column(Integer, nullable=False)
    push_count: Mapped[int] = mapped_column(Integer, nullable=False)  # recipients who had a device (people)
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("user_account.id", ondelete="SET NULL")
    )

    __table_args__ = (sa.Index("ix_notification_broadcast_created_at", "created_at", "id"),)
