"""A customer's saved posts, artists and shop products. No FK to the target (three kinds): a target that is
gone or hidden simply drops out of the lists."""

import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy import DateTime, Enum, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.saved.constants import SavedKind
from app.shared.models import Base

saved_kind_enum = Enum(SavedKind, name="saved_item_kind", values_callable=lambda e: [m.value for m in e])


class SavedItem(Base):
    __tablename__ = "saved_item"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("user_account.id", ondelete="CASCADE"), primary_key=True
    )
    kind: Mapped[SavedKind] = mapped_column(saved_kind_enum, primary_key=True)
    target_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    saved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (sa.Index("ix_saved_item_user_kind_saved", "user_id", "kind", sa.text("saved_at DESC")),)
