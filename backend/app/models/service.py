# app/models/service.py — table artist_services, class Service (avoids collision with services/artist_service.py)
import uuid
from decimal import Decimal

import sqlalchemy as sa
from sqlalchemy import Boolean, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class Service(Base, TimestampMixin):
    __tablename__ = "artist_services"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
    )
    artist_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("artist_profiles.id", ondelete="CASCADE"), nullable=False
    )
    service_name: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    category: Mapped[str | None] = mapped_column(String(100))
    starting_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("0.00"), nullable=False)
    duration_minutes: Mapped[int | None] = mapped_column(Integer)
    booking_type: Mapped[str] = mapped_column(String(20), default="request", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    artist = relationship("ArtistProfile", back_populates="services")
    inclusions = relationship("ServiceInclusion", back_populates="service", cascade="all, delete-orphan")
    addons = relationship("ServiceAddon", back_populates="service", cascade="all, delete-orphan")
