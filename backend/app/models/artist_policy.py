# app/models/artist_policy.py — mirrors artist_policies (one row per artist)
import uuid

import sqlalchemy as sa
from sqlalchemy import ForeignKey, Integer, SmallInteger, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class ArtistPolicy(Base, TimestampMixin):
    __tablename__ = "artist_policies"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
    )
    artist_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("artist_profiles.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    advance_payment_percentage: Mapped[int] = mapped_column(SmallInteger, default=30, nullable=False)  # DB CHECK IN (10,30,50,100)
    free_cancellation_hours: Mapped[int] = mapped_column(Integer, default=24, nullable=False)
    refund_percentage: Mapped[int] = mapped_column(SmallInteger, default=50, nullable=False)
    travel_policy: Mapped[str | None] = mapped_column(Text)
    additional_rules: Mapped[str | None] = mapped_column(Text)

    artist = relationship("ArtistProfile", back_populates="policy")
