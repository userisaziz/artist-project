"""bookings: customer requests with a mocked deposit, answered by the artist (migration #8)

Revision ID: a3b5c7d9e1f2
Revises: f7a2c4e6b8d1
Create Date: 2026-10-17
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "a3b5c7d9e1f2"
down_revision: str | Sequence[str] | None = "f7a2c4e6b8d1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        "CREATE TYPE booking_status AS ENUM ('requested', 'confirmed', 'declined', 'expired', 'cancelled', 'completed')"
    )
    op.create_table(
        "bookings",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("code", sa.String(length=12), nullable=False),
        sa.Column("customer_id", sa.UUID(), nullable=False),
        sa.Column("artist_id", sa.UUID(), nullable=False),
        sa.Column("service_id", sa.UUID(), nullable=True),
        sa.Column("service_name", sa.String(length=120), nullable=False),
        sa.Column("duration_minutes", sa.Integer(), nullable=False),
        sa.Column("start_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("address", sa.String(length=300), nullable=False),
        sa.Column("note", sa.String(length=500), nullable=True),
        sa.Column(
            "status",
            postgresql.ENUM(name="booking_status", create_type=False),
            server_default=sa.text("'requested'"),
            nullable=False,
        ),
        sa.Column("subtotal_paise", sa.Integer(), nullable=False),
        sa.Column("platform_fee_paise", sa.Integer(), nullable=False),
        sa.Column("total_paise", sa.Integer(), nullable=False),
        sa.Column("deposit_paise", sa.Integer(), nullable=False),
        sa.Column("commission_paise", sa.Integer(), nullable=False),
        sa.Column("deposit_paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("payment_provider", sa.String(length=20), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("responded_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelled_by", sa.String(length=10), nullable=True),
        sa.Column("decline_reason", sa.String(length=500), nullable=True),
        sa.Column("cancel_reason", sa.String(length=500), nullable=True),
        sa.Column("refund_due", sa.Boolean(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint(
            "subtotal_paise >= 0 AND platform_fee_paise >= 0 AND total_paise >= 0 "
            "AND deposit_paise >= 0 AND commission_paise >= 0",
            name="ck_bookings_money_non_negative",
        ),
        sa.CheckConstraint("end_at > start_at", name="ck_bookings_end_after_start"),
        sa.ForeignKeyConstraint(["customer_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["artist_id"], ["artist_profiles.id"]),
        sa.ForeignKeyConstraint(["service_id"], ["artist_services.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code"),
    )
    op.create_index("ix_bookings_customer_id", "bookings", ["customer_id"])
    op.create_index("ix_bookings_artist_id", "bookings", ["artist_id"])
    op.create_index("ix_bookings_status", "bookings", ["status"])
    op.create_index("ix_bookings_artist_start", "bookings", ["artist_id", "start_at"])


def downgrade() -> None:
    op.drop_table("bookings")
    op.execute("DROP TYPE booking_status")
