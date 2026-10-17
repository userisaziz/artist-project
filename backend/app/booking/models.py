# app/models/booking.py — a customer's booking request for one artist service (migration #8)
import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.shared.enums import BookingStatus
from app.shared.models import Base, TimestampMixin

booking_status_enum = Enum(BookingStatus, name="booking_status", values_callable=lambda e: [m.value for m in e])


class Booking(Base, TimestampMixin):
    """Service name, duration and every money figure are copied in at request time:
    later edits to the service or to fee settings never change an existing booking."""

    __tablename__ = "bookings"
    __mapper_args__ = {"eager_defaults": True}

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
    )
    code: Mapped[str] = mapped_column(String(12), unique=True, nullable=False)  # human id, e.g. BK-7F3K2Q
    customer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    artist_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("artist_profiles.id"), nullable=False, index=True
    )
    service_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("artist_services.id", ondelete="SET NULL")
    )
    service_name: Mapped[str] = mapped_column(String(120), nullable=False)
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    address: Mapped[str] = mapped_column(String(300), nullable=False)
    note: Mapped[str | None] = mapped_column(String(500))
    status: Mapped[BookingStatus] = mapped_column(
        booking_status_enum, default=BookingStatus.requested, server_default=sa.text("'requested'"),
        nullable=False, index=True,
    )
    subtotal_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    platform_fee_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    total_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    deposit_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    commission_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    deposit_paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    payment_provider: Mapped[str] = mapped_column(String(20), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    responded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancelled_by: Mapped[str | None] = mapped_column(String(10))  # customer | artist | admin
    decline_reason: Mapped[str | None] = mapped_column(String(500))
    cancel_reason: Mapped[str | None] = mapped_column(String(500))
    refund_due: Mapped[bool | None] = mapped_column(Boolean)

    __table_args__ = (
        sa.Index("ix_bookings_artist_start", "artist_id", "start_at"),
        sa.CheckConstraint(
            "subtotal_paise >= 0 AND platform_fee_paise >= 0 AND total_paise >= 0 "
            "AND deposit_paise >= 0 AND commission_paise >= 0",
            name="ck_bookings_money_non_negative",
        ),
        sa.CheckConstraint("end_at > start_at", name="ck_bookings_end_after_start"),
    )

    @property
    def balance_paise(self) -> int:
        return self.total_paise - self.deposit_paise

    @property
    def artist_earning_paise(self) -> int:
        return self.subtotal_paise - self.commission_paise
