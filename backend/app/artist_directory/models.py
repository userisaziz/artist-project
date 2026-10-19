"""Why, when and by whom an artist was suspended. One row while suspended; reinstating deletes it (the audit
log keeps the history)."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.shared.models import Base


class ArtistSuspension(Base):
    __tablename__ = "artist_suspension"

    artist_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("artist_profile.id", ondelete="CASCADE"), primary_key=True
    )
    reason: Mapped[str] = mapped_column(String(500), nullable=False)
    suspended_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    suspended_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("user_account.id", ondelete="SET NULL")
    )
