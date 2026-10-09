# app/models/artist_availability.py — mirrors artist_availability (CHECK constraints live in the DB, not the models)
import uuid
from datetime import time

import sqlalchemy as sa
from sqlalchemy import Boolean, ForeignKey, SmallInteger, Time
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class ArtistAvailability(Base, TimestampMixin):
    __tablename__ = "artist_availability"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
    )
    artist_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("artist_profiles.id", ondelete="CASCADE"), nullable=False
    )
    day_of_week: Mapped[int] = mapped_column(SmallInteger, nullable=False)  # DB CHECK 0-6
    start_time: Mapped[time] = mapped_column(Time, nullable=False)          # DB CHECK end>start
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    is_available: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    artist = relationship("ArtistProfile", back_populates="availability")
