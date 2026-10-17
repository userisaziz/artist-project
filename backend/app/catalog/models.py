"""Service categories (Mehendi, Makeup, …), their subcategories, and the admin's service list under each
subcategory (migration #6). Admins create them in the admin app."""

import sqlalchemy as sa
from sqlalchemy import Boolean, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.shared.enums import CategoryStatus
from app.shared.models import Base


class Category(Base):
    __tablename__ = "catalog_category"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # NULL = top-level category; set = subcategory. Only two levels (enforced in CategoryService).
    parent_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("catalog_category.id"), index=True)
    slug: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    status: Mapped[CategoryStatus] = mapped_column(
        Enum(CategoryStatus, name="category_status", values_callable=lambda e: [m.value for m in e]),
        default=CategoryStatus.draft,
        server_default=sa.text("'draft'"),
        nullable=False,
    )


class ServiceTemplate(Base):
    """A service artists can pick during onboarding; each artist sets their own price and duration."""

    __tablename__ = "catalog_service_template"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    subcategory_id: Mapped[int] = mapped_column(Integer, ForeignKey("catalog_category.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # One name per subcategory, case-insensitively.
    __table_args__ = (
        sa.Index("uq_catalog_service_template_subcategory_name", "subcategory_id", sa.text("lower(name)"), unique=True),
        sa.Index(
            "ix_catalog_service_template_name_trgm",
            "name",
            postgresql_using="gin",
            postgresql_ops={"name": "gin_trgm_ops"},
        ),
    )
