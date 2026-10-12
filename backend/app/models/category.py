# app/models/category.py — service categories (Mehendi, Makeup, …) and their subcategories; admins create them in the admin app
from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # NULL = top-level category; set = subcategory. Only two levels (enforced in CategoryService).
    parent_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("categories.id"), index=True)
    slug: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
