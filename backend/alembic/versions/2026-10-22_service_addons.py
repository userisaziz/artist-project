"""Service extras: "What's included" lines on a service, priced add-ons, and the add-ons picked on each booking.

Revision ID: 5b8d2f4a7c19
Revises: 7e2a9c4d1f63
Create Date: 2026-10-22
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "5b8d2f4a7c19"
down_revision: str | Sequence[str] | None = "7e2a9c4d1f63"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

NEW_ID = sa.text("gen_random_uuid()")


def upgrade() -> None:
    op.add_column(
        "artist_service_item",
        sa.Column(
            "included_items", postgresql.ARRAY(sa.String(length=60)), server_default=sa.text("'{}'"), nullable=False
        ),
    )
    op.create_table(
        "artist_service_addon",
        sa.Column("id", sa.UUID(), server_default=NEW_ID, nullable=False),
        sa.Column("service_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(length=80), nullable=False),
        sa.Column("price_paise", sa.Integer(), nullable=False),
        sa.Column("per_person", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.CheckConstraint("price_paise > 0", name="ck_artist_service_addon_price_positive"),
        sa.ForeignKeyConstraint(
            ["service_id"],
            ["artist_service_item.id"],
            name="fk_artist_service_addon_service_id_artist_service_item",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_artist_service_addon"),
    )
    op.create_index("ix_artist_service_addon_service_id", "artist_service_addon", ["service_id"])
    op.create_table(
        "booking_addon",
        sa.Column("id", sa.UUID(), server_default=NEW_ID, nullable=False),
        sa.Column("booking_id", sa.UUID(), nullable=False),
        sa.Column("addon_id", sa.UUID(), nullable=True),
        sa.Column("name", sa.String(length=80), nullable=False),
        sa.Column("unit_price_paise", sa.Integer(), nullable=False),
        sa.Column("per_person", sa.Boolean(), nullable=False),
        sa.Column("guests", sa.SmallInteger(), nullable=False),
        sa.Column("line_paise", sa.Integer(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.CheckConstraint("unit_price_paise > 0", name="ck_booking_addon_unit_price_positive"),
        sa.CheckConstraint("guests >= 1", name="ck_booking_addon_guests_positive"),
        sa.CheckConstraint("line_paise = unit_price_paise * guests", name="ck_booking_addon_line_is_unit_times_guests"),
        sa.ForeignKeyConstraint(
            ["booking_id"], ["booking.id"], name="fk_booking_addon_booking_id_booking", ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["addon_id"],
            ["artist_service_addon.id"],
            name="fk_booking_addon_addon_id_artist_service_addon",
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_booking_addon"),
    )
    op.create_index("ix_booking_addon_booking_id", "booking_addon", ["booking_id"])
    op.create_index("ix_booking_addon_addon_id", "booking_addon", ["addon_id"])


def downgrade() -> None:
    op.drop_index("ix_booking_addon_addon_id", table_name="booking_addon")
    op.drop_index("ix_booking_addon_booking_id", table_name="booking_addon")
    op.drop_table("booking_addon")
    op.drop_index("ix_artist_service_addon_service_id", table_name="artist_service_addon")
    op.drop_table("artist_service_addon")
    op.drop_column("artist_service_item", "included_items")
