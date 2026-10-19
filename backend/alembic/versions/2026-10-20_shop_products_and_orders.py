"""Shop: artists' shop settings, products and photos, and orders with items and history (no in-app payments).

Revision ID: 1f6a3c9e2d58
Revises: 9d1f3b5a7c24
Create Date: 2026-10-20
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "1f6a3c9e2d58"
down_revision: str | Sequence[str] | None = "9d1f3b5a7c24"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

product_status = postgresql.ENUM("live", "removed", name="shop_product_status", create_type=False)
order_status = postgresql.ENUM(
    "placed", "confirmed", "shipped", "delivered", "cancelled", name="shop_order_status", create_type=False
)
NOW = sa.text("now()")
NEW_ID = sa.text("gen_random_uuid()")


def timestamps() -> list[sa.Column]:
    return [
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=NOW, nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=NOW, nullable=False),
    ]


def upgrade() -> None:
    product_status.create(op.get_bind(), checkfirst=False)
    order_status.create(op.get_bind(), checkfirst=False)
    op.create_table(
        "shop_settings",
        sa.Column("artist_id", sa.UUID(), nullable=False),
        sa.Column("pay_on_delivery", sa.Boolean(), nullable=False),
        sa.Column("pay_before_shipping", sa.Boolean(), nullable=False),
        sa.Column("delivery_fee_paise", sa.Integer(), nullable=False),
        sa.Column("free_delivery_over_paise", sa.Integer(), nullable=True),
        *timestamps(),
        sa.CheckConstraint("pay_on_delivery OR pay_before_shipping", name="ck_shop_settings_accepts_a_payment_method"),
        sa.CheckConstraint("delivery_fee_paise >= 0", name="ck_shop_settings_delivery_fee_non_negative"),
        sa.ForeignKeyConstraint(
            ["artist_id"], ["artist_profile.id"], name="fk_shop_settings_artist_id_artist_profile", ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("artist_id", name="pk_shop_settings"),
    )
    op.create_table(
        "shop_product",
        sa.Column("id", sa.UUID(), server_default=NEW_ID, nullable=False),
        sa.Column("artist_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("category", sa.String(length=20), nullable=False),
        sa.Column("price_paise", sa.Integer(), nullable=False),
        sa.Column("mrp_paise", sa.Integer(), nullable=True),
        sa.Column("stock", sa.Integer(), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("status", product_status, server_default=sa.text("'live'"), nullable=False),
        sa.Column("removed_reason", sa.String(length=500), nullable=True),
        sa.Column("payment_methods", postgresql.ARRAY(sa.String(length=30)), nullable=True),
        *timestamps(),
        sa.CheckConstraint("price_paise > 0", name="ck_shop_product_price_positive"),
        sa.CheckConstraint("mrp_paise IS NULL OR mrp_paise >= price_paise", name="ck_shop_product_mrp_not_below_price"),
        sa.CheckConstraint("stock >= 0", name="ck_shop_product_stock_non_negative"),
        sa.ForeignKeyConstraint(
            ["artist_id"], ["artist_profile.id"], name="fk_shop_product_artist_id_artist_profile", ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name="pk_shop_product"),
    )
    op.create_index("ix_shop_product_created", "shop_product", ["created_at", "id"])
    op.create_index("ix_shop_product_artist_created", "shop_product", ["artist_id", "created_at", "id"])
    op.create_table(
        "shop_product_photo",
        sa.Column("id", sa.UUID(), server_default=NEW_ID, nullable=False),
        sa.Column("product_id", sa.UUID(), nullable=False),
        sa.Column("storage_key", sa.String(length=255), nullable=False),
        sa.Column("width", sa.Integer(), nullable=False),
        sa.Column("height", sa.Integer(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["product_id"],
            ["shop_product.id"],
            name="fk_shop_product_photo_product_id_shop_product",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_shop_product_photo"),
        sa.UniqueConstraint("storage_key", name="uq_shop_product_photo_storage_key"),
    )
    op.create_index("ix_shop_product_photo_product_id", "shop_product_photo", ["product_id"])
    op.create_table(
        "shop_order",
        sa.Column("id", sa.UUID(), server_default=NEW_ID, nullable=False),
        sa.Column("code", sa.String(length=12), nullable=False),
        sa.Column("customer_id", sa.UUID(), nullable=False),
        sa.Column("artist_id", sa.UUID(), nullable=False),
        sa.Column("status", order_status, nullable=False),
        sa.Column("payment_method", sa.String(length=30), nullable=False),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("address", sa.String(length=300), nullable=False),
        sa.Column("subtotal_paise", sa.Integer(), nullable=False),
        sa.Column("delivery_fee_paise", sa.Integer(), nullable=False),
        sa.Column("total_paise", sa.Integer(), nullable=False),
        sa.Column("tracking", sa.String(length=120), nullable=True),
        sa.Column("cancelled_by", sa.String(length=10), nullable=True),
        sa.Column("cancel_reason", sa.String(length=500), nullable=True),
        *timestamps(),
        sa.CheckConstraint(
            "subtotal_paise >= 0 AND delivery_fee_paise >= 0 AND total_paise >= 0",
            name="ck_shop_order_money_non_negative",
        ),
        sa.ForeignKeyConstraint(["artist_id"], ["artist_profile.id"], name="fk_shop_order_artist_id_artist_profile"),
        sa.ForeignKeyConstraint(["customer_id"], ["user_account.id"], name="fk_shop_order_customer_id_user_account"),
        sa.PrimaryKeyConstraint("id", name="pk_shop_order"),
        sa.UniqueConstraint("code", name="uq_shop_order_code"),
    )
    op.create_index("ix_shop_order_created", "shop_order", ["created_at", "id"])
    op.create_index("ix_shop_order_customer_id", "shop_order", ["customer_id"])
    op.create_index("ix_shop_order_artist_id", "shop_order", ["artist_id"])
    op.create_index("ix_shop_order_status", "shop_order", ["status"])
    op.create_table(
        "shop_order_item",
        sa.Column("id", sa.UUID(), server_default=NEW_ID, nullable=False),
        sa.Column("order_id", sa.UUID(), nullable=False),
        sa.Column("product_id", sa.UUID(), nullable=True),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("unit_price_paise", sa.Integer(), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.CheckConstraint("quantity > 0", name="ck_shop_order_item_quantity_positive"),
        sa.ForeignKeyConstraint(
            ["order_id"], ["shop_order.id"], name="fk_shop_order_item_order_id_shop_order", ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["product_id"], ["shop_product.id"], name="fk_shop_order_item_product_id_shop_product", ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id", name="pk_shop_order_item"),
    )
    op.create_index("ix_shop_order_item_order_id", "shop_order_item", ["order_id"])
    op.create_index("ix_shop_order_item_product_id", "shop_order_item", ["product_id"])
    op.create_table(
        "shop_order_event",
        sa.Column("id", sa.UUID(), server_default=NEW_ID, nullable=False),
        sa.Column("order_id", sa.UUID(), nullable=False),
        sa.Column("status", order_status, nullable=False),
        sa.Column("at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["order_id"], ["shop_order.id"], name="fk_shop_order_event_order_id_shop_order", ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name="pk_shop_order_event"),
    )
    op.create_index("ix_shop_order_event_order_id", "shop_order_event", ["order_id"])


def downgrade() -> None:
    op.drop_index("ix_shop_order_event_order_id", table_name="shop_order_event")
    op.drop_table("shop_order_event")
    for name in ("ix_shop_order_item_product_id", "ix_shop_order_item_order_id"):
        op.drop_index(name, table_name="shop_order_item")
    op.drop_table("shop_order_item")
    for name in (
        "ix_shop_order_status",
        "ix_shop_order_artist_id",
        "ix_shop_order_customer_id",
        "ix_shop_order_created",
    ):
        op.drop_index(name, table_name="shop_order")
    op.drop_table("shop_order")
    op.drop_index("ix_shop_product_photo_product_id", table_name="shop_product_photo")
    op.drop_table("shop_product_photo")
    op.drop_index("ix_shop_product_artist_created", table_name="shop_product")
    op.drop_index("ix_shop_product_created", table_name="shop_product")
    op.drop_table("shop_product")
    op.drop_table("shop_settings")
    order_status.drop(op.get_bind(), checkfirst=False)
    product_status.drop(op.get_bind(), checkfirst=False)
