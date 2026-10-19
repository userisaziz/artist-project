"""Shop: each artist's shop settings, their products and photos, and customers' orders (one per artist),
with their items and status history. Money figures are copied onto orders; nothing is paid in the app."""

import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.shared.models import Base, TimestampMixin
from app.shop.constants import ADDRESS_MAX, NAME_MAX, REASON_MAX, TRACKING_MAX, OrderStatus, ProductStatus

product_status_enum = Enum(ProductStatus, name="shop_product_status", values_callable=lambda e: [m.value for m in e])
order_status_enum = Enum(OrderStatus, name="shop_order_status", values_callable=lambda e: [m.value for m in e])


class ShopSettings(Base, TimestampMixin):
    """An artist's shop defaults: the payment methods they accept and their delivery charge."""

    __tablename__ = "shop_settings"

    artist_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("artist_profile.id", ondelete="CASCADE"), primary_key=True
    )
    pay_on_delivery: Mapped[bool] = mapped_column(Boolean, nullable=False)
    pay_before_shipping: Mapped[bool] = mapped_column(Boolean, nullable=False)
    delivery_fee_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    free_delivery_over_paise: Mapped[int | None] = mapped_column(Integer)

    __table_args__ = (
        sa.CheckConstraint("pay_on_delivery OR pay_before_shipping", name="accepts_a_payment_method"),
        sa.CheckConstraint("delivery_fee_paise >= 0", name="delivery_fee_non_negative"),
    )


class Product(Base, TimestampMixin):
    __tablename__ = "shop_product"
    __mapper_args__ = {"eager_defaults": True}

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
    )
    artist_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("artist_profile.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(NAME_MAX), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(20), nullable=False)
    price_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    mrp_paise: Mapped[int | None] = mapped_column(Integer)
    stock: Mapped[int] = mapped_column(Integer, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default=sa.true(), nullable=False)
    status: Mapped[ProductStatus] = mapped_column(
        product_status_enum, default=ProductStatus.live, server_default=sa.text("'live'"), nullable=False
    )
    removed_reason: Mapped[str | None] = mapped_column(String(REASON_MAX))
    # NULL: the artist's shop default applies.
    payment_methods: Mapped[list[str] | None] = mapped_column(ARRAY(String(30)))
    photos: Mapped[list["ProductPhoto"]] = relationship(
        lazy="selectin", cascade="all, delete-orphan", order_by="ProductPhoto.sort_order"
    )

    __table_args__ = (
        sa.Index("ix_shop_product_created", "created_at", "id"),
        sa.Index("ix_shop_product_artist_created", "artist_id", "created_at", "id"),
        sa.CheckConstraint("price_paise > 0", name="price_positive"),
        sa.CheckConstraint("mrp_paise IS NULL OR mrp_paise >= price_paise", name="mrp_not_below_price"),
        sa.CheckConstraint("stock >= 0", name="stock_non_negative"),
    )


class ProductPhoto(Base):
    __tablename__ = "shop_product_photo"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("shop_product.id", ondelete="CASCADE"), nullable=False, index=True
    )
    storage_key: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    width: Mapped[int] = mapped_column(Integer, nullable=False)
    height: Mapped[int] = mapped_column(Integer, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False)


class Order(Base, TimestampMixin):
    __tablename__ = "shop_order"
    __mapper_args__ = {"eager_defaults": True}

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
    )
    code: Mapped[str] = mapped_column(String(12), unique=True, nullable=False)  # e.g. AT-7F3K2Q
    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("user_account.id"), nullable=False, index=True
    )
    artist_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("artist_profile.id"), nullable=False, index=True
    )
    status: Mapped[OrderStatus] = mapped_column(order_status_enum, nullable=False, index=True)
    payment_method: Mapped[str] = mapped_column(String(30), nullable=False)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))  # marked by the artist
    address: Mapped[str] = mapped_column(String(ADDRESS_MAX), nullable=False)
    subtotal_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    delivery_fee_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    total_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    tracking: Mapped[str | None] = mapped_column(String(TRACKING_MAX))
    cancelled_by: Mapped[str | None] = mapped_column(String(10))  # customer | artist | admin
    cancel_reason: Mapped[str | None] = mapped_column(String(REASON_MAX))
    items: Mapped[list["OrderItem"]] = relationship(lazy="selectin", cascade="all, delete-orphan")
    events: Mapped[list["OrderEvent"]] = relationship(
        lazy="selectin", cascade="all, delete-orphan", order_by="OrderEvent.at"
    )

    __table_args__ = (
        sa.Index("ix_shop_order_created", "created_at", "id"),
        sa.CheckConstraint(
            "subtotal_paise >= 0 AND delivery_fee_paise >= 0 AND total_paise >= 0", name="money_non_negative"
        ),
    )


class OrderItem(Base):
    """A product line, with its name and price copied at order time."""

    __tablename__ = "shop_order_item"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
    )
    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("shop_order.id", ondelete="CASCADE"), nullable=False, index=True
    )
    product_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("shop_product.id", ondelete="SET NULL"), index=True
    )
    name: Mapped[str] = mapped_column(String(NAME_MAX), nullable=False)
    unit_price_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)

    __table_args__ = (sa.CheckConstraint("quantity > 0", name="quantity_positive"),)


class OrderEvent(Base):
    """One step in an order's history, for the customer's timeline."""

    __tablename__ = "shop_order_event"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
    )
    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("shop_order.id", ondelete="CASCADE"), nullable=False, index=True
    )
    status: Mapped[OrderStatus] = mapped_column(order_status_enum, nullable=False)
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
