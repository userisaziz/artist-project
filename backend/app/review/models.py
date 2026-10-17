# app/models/review.py — a customer's rating of one completed booking, with moderation and the artist's reply (migration #9)
import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy import DateTime, Enum, ForeignKey, SmallInteger, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.shared.enums import ReviewStatus
from app.shared.models import Base, TimestampMixin

review_status_enum = Enum(ReviewStatus, name="review_status", values_callable=lambda e: [m.value for m in e])
PUBLIC_REVIEW = (ReviewStatus.published, ReviewStatus.flagged)


class Review(Base, TimestampMixin):
    __tablename__ = "review"
    __mapper_args__ = {"eager_defaults": True}

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
    )
    booking_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("booking.id"), unique=True, nullable=False
    )
    artist_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("artist_profile.id"), nullable=False, index=True
    )
    customer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("user_account.id"), nullable=False)
    rating: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    text: Mapped[str | None] = mapped_column(String(1000))
    status: Mapped[ReviewStatus] = mapped_column(review_status_enum, nullable=False, index=True)
    flag: Mapped[str | None] = mapped_column(String(20))  # contact_info | blocked_word | artist_report
    report_reason: Mapped[str | None] = mapped_column(String(500))
    moderator_note: Mapped[str | None] = mapped_column(String(500))
    moderated_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("user_account.id"))
    moderated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    reply: Mapped[str | None] = mapped_column(String(500))
    replied_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    __table_args__ = (sa.CheckConstraint("rating BETWEEN 1 AND 5", name="rating_range"),)
