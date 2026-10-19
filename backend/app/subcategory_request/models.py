"""A subcategory an artist suggested while adding a custom service. It isn't a catalog category until an admin
approves it, so nobody else sees it; its waiting services sit under the parent category meanwhile."""

import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.shared.models import Base, TimestampMixin
from app.subcategory_request.constants import (
    DESCRIPTION_MAX_LENGTH,
    NAME_MAX_LENGTH,
    SubcategoryRequestStatus,
)

request_status_enum = Enum(
    SubcategoryRequestStatus, name="subcategory_request_status", values_callable=lambda e: [m.value for m in e]
)


class SubcategoryRequest(Base, TimestampMixin):
    __tablename__ = "subcategory_request"
    __mapper_args__ = {"eager_defaults": True}

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
    )
    artist_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("artist_profile.id", ondelete="CASCADE"), nullable=False, index=True
    )
    parent_id: Mapped[int] = mapped_column(Integer, ForeignKey("catalog_category.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(NAME_MAX_LENGTH), nullable=False)
    description: Mapped[str | None] = mapped_column(String(DESCRIPTION_MAX_LENGTH))
    status: Mapped[SubcategoryRequestStatus] = mapped_column(
        request_status_enum,
        default=SubcategoryRequestStatus.pending,
        server_default=sa.text("'pending'"),
        nullable=False,
    )
    rejection_reason: Mapped[str | None] = mapped_column(String(500))
    # Set on approval: the catalog subcategory it became.
    subcategory_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("catalog_category.id", ondelete="SET NULL"))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    reviewed_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("user_account.id", ondelete="SET NULL")
    )

    __table_args__ = (sa.Index("ix_subcategory_request_status_created", "status", "created_at", "id"),)
