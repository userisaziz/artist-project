"""Service categories (Mehendi, Makeup, …), their subcategories, and the admin's service list under each
subcategory (migration #6). Admins create them in the admin app. Also the areas of each operating city
(BTM Layout, Koramangala, …) that artists place their studio in."""

import sqlalchemy as sa
from sqlalchemy import Boolean, Enum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
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
    # How its services are fulfilled (app.catalog.fields.Fulfilment); NULL on a subcategory = the parent's.
    fulfilment: Mapped[str | None] = mapped_column(String(20))
    # Admin-defined extra fields (list of app.catalog.fields.FieldDef); a subcategory's come after its parent's.
    field_schema: Mapped[list[dict]] = mapped_column(
        JSONB, nullable=False, default=list, server_default=sa.text("'[]'")
    )
    # What per-unit services here are usually counted in (app.artist.constants.QuantityUnit); NULL = the parent's.
    default_unit: Mapped[str | None] = mapped_column(String(10))

    __table_args__ = (
        sa.CheckConstraint(
            "fulfilment IS NULL OR fulfilment IN ('appointment', 'made_to_order')", name="fulfilment_known"
        ),
        sa.CheckConstraint(
            "default_unit IS NULL OR default_unit IN ('person', 'piece', 'box', 'card', 'hour', 'set')",
            name="default_unit_known",
        ),
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


class Area(Base):
    """A neighbourhood of an operating city, with its rough centre: what customers see as "BTM Layout, Bangalore"
    and what a dropped pin snaps to. Seeded by migration; admins will edit them later."""

    __tablename__ = "catalog_area"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    city: Mapped[str] = mapped_column(String(60), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default=sa.true(), nullable=False)

    __table_args__ = (sa.UniqueConstraint("city", "name"),)
