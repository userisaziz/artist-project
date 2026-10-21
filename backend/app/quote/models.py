"""A customer's enquiry to one artist and the artist's current quote for it (re-quoting overwrites it)."""

import uuid
from datetime import date, datetime

import sqlalchemy as sa
from sqlalchemy import Date, DateTime, Enum, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.quote.constants import DETAILS_MAX, NOTE_MAX, REASON_MAX, EnquiryStatus
from app.shared.models import Base, TimestampMixin

enquiry_status_enum = Enum(EnquiryStatus, name="quote_enquiry_status", values_callable=lambda e: [m.value for m in e])

QUOTE_ALL_OR_NONE = (
    "(quote_price_paise IS NULL AND quote_duration_minutes IS NULL AND quote_valid_until_date IS NULL "
    "AND quoted_at IS NULL) OR (quote_price_paise IS NOT NULL AND quote_duration_minutes IS NOT NULL "
    "AND quote_valid_until_date IS NOT NULL AND quoted_at IS NOT NULL)"
)
LIVE_STATUSES = "status IN ('open', 'quoted')"


class QuoteEnquiry(Base, TimestampMixin):
    __tablename__ = "quote_enquiry"
    __mapper_args__ = {"eager_defaults": True}

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
    )
    customer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("user_account.id"), nullable=False)
    artist_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("artist_profile.id"), nullable=False)
    status: Mapped[EnquiryStatus] = mapped_column(enquiry_status_enum, nullable=False, index=True)
    event_date: Mapped[date] = mapped_column(Date, nullable=False)
    details: Mapped[str] = mapped_column(String(DETAILS_MAX), nullable=False)
    budget_paise: Mapped[int | None] = mapped_column(Integer)
    quote_price_paise: Mapped[int | None] = mapped_column(Integer)
    quote_duration_minutes: Mapped[int | None] = mapped_column(Integer)
    quote_note: Mapped[str | None] = mapped_column(String(NOTE_MAX))
    quote_valid_until_date: Mapped[date | None] = mapped_column(Date)
    quoted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    decline_reason: Mapped[str | None] = mapped_column(String(REASON_MAX))
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))  # accepted, declined or cancelled
    booking_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("booking.id", ondelete="SET NULL")
    )

    __table_args__ = (
        sa.CheckConstraint("budget_paise IS NULL OR budget_paise > 0", name="budget_positive"),
        sa.CheckConstraint("quote_price_paise IS NULL OR quote_price_paise > 0", name="quote_price_positive"),
        sa.CheckConstraint(QUOTE_ALL_OR_NONE, name="quote_all_or_none"),
        # One live enquiry per customer and artist, whatever code path writes it (the service checks first).
        sa.Index(
            "uq_quote_enquiry_live_customer_artist",
            "customer_id",
            "artist_id",
            unique=True,
            postgresql_where=sa.text(LIVE_STATUSES),
        ),
        sa.Index("ix_quote_enquiry_customer_created", "customer_id", "created_at", "id"),
        sa.Index("ix_quote_enquiry_artist_created", "artist_id", "created_at", "id"),
    )
