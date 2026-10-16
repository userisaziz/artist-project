# app/models/category.py — service categories (Mehendi, Makeup, …) and their subcategories; admins create them in the admin app
import sqlalchemy as sa
from sqlalchemy import Enum, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.utils.enums import CategoryStatus


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # NULL = top-level category; set = subcategory. Only two levels (enforced in CategoryService).
    parent_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("categories.id"), index=True)
    slug: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    status: Mapped[CategoryStatus] = mapped_column(
        Enum(CategoryStatus, name="category_status", values_callable=lambda e: [m.value for m in e]),
        default=CategoryStatus.draft,
        server_default=sa.text("'draft'"),
        nullable=False,
    )
