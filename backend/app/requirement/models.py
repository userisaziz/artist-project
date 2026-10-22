import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy import Boolean, DateTime, ForeignKey, SmallInteger, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.requirement.constants import DEFAULT_GRACE_DAYS
from app.shared.models import Base, TimestampMixin


class RequirementSetting(Base, TimestampMixin):
    """Admin switch for one requirement (constants.REQUIREMENTS). Mandatory from `effective_from`; approved artists
    still missing it `grace_days` later are on hold (hidden, no new bookings) until they complete it."""

    __tablename__ = "requirement_setting"

    key: Mapped[str] = mapped_column(String(40), primary_key=True)
    mandatory: Mapped[bool] = mapped_column(Boolean, default=False, server_default=sa.false(), nullable=False)
    grace_days: Mapped[int] = mapped_column(
        SmallInteger, default=DEFAULT_GRACE_DAYS, server_default=sa.text(str(DEFAULT_GRACE_DAYS)), nullable=False
    )
    effective_from: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))  # set when switched on

    __table_args__ = (sa.CheckConstraint("grace_days BETWEEN 0 AND 90", name="grace_days_range"),)


class RequirementNotice(Base):
    """One automatic notice (warning, then on hold) sent to an artist for a requirement, so none repeats."""

    __tablename__ = "requirement_notice"

    artist_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("artist_profile.id", ondelete="CASCADE"), primary_key=True
    )
    key: Mapped[str] = mapped_column(String(40), primary_key=True)
    stage: Mapped[str] = mapped_column(String(30), primary_key=True)
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
