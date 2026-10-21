"""Enquiries & quotes: a customer's enquiry to an artist and the artist's current quote for it.

Revision ID: 3d6f8a2c5e71
Revises: 9c4e7a1d3b52
Create Date: 2026-10-21
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "3d6f8a2c5e71"
down_revision: str | Sequence[str] | None = "9c4e7a1d3b52"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

status = postgresql.ENUM(
    "open", "quoted", "accepted", "declined", "cancelled", "expired", name="quote_enquiry_status", create_type=False
)
NOW = sa.text("now()")
QUOTE_ALL_OR_NONE = (
    "(quote_price_paise IS NULL AND quote_duration_minutes IS NULL AND quote_valid_until_date IS NULL "
    "AND quoted_at IS NULL) OR (quote_price_paise IS NOT NULL AND quote_duration_minutes IS NOT NULL "
    "AND quote_valid_until_date IS NOT NULL AND quoted_at IS NOT NULL)"
)


def upgrade() -> None:
    status.create(op.get_bind(), checkfirst=False)
    op.create_table(
        "quote_enquiry",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("customer_id", sa.UUID(), nullable=False),
        sa.Column("artist_id", sa.UUID(), nullable=False),
        sa.Column("status", status, nullable=False),
        sa.Column("event_date", sa.Date(), nullable=False),
        sa.Column("details", sa.String(length=1000), nullable=False),
        sa.Column("budget_paise", sa.Integer(), nullable=True),
        sa.Column("quote_price_paise", sa.Integer(), nullable=True),
        sa.Column("quote_duration_minutes", sa.Integer(), nullable=True),
        sa.Column("quote_note", sa.String(length=500), nullable=True),
        sa.Column("quote_valid_until_date", sa.Date(), nullable=True),
        sa.Column("quoted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("decline_reason", sa.String(length=500), nullable=True),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("booking_id", sa.UUID(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=NOW, nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=NOW, nullable=False),
        sa.CheckConstraint("budget_paise IS NULL OR budget_paise > 0", name="ck_quote_enquiry_budget_positive"),
        sa.CheckConstraint(
            "quote_price_paise IS NULL OR quote_price_paise > 0", name="ck_quote_enquiry_quote_price_positive"
        ),
        sa.CheckConstraint(QUOTE_ALL_OR_NONE, name="ck_quote_enquiry_quote_all_or_none"),
        sa.ForeignKeyConstraint(["artist_id"], ["artist_profile.id"], name="fk_quote_enquiry_artist_id_artist_profile"),
        sa.ForeignKeyConstraint(
            ["booking_id"], ["booking.id"], name="fk_quote_enquiry_booking_id_booking", ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(["customer_id"], ["user_account.id"], name="fk_quote_enquiry_customer_id_user_account"),
        sa.PrimaryKeyConstraint("id", name="pk_quote_enquiry"),
    )
    op.create_index("ix_quote_enquiry_status", "quote_enquiry", ["status"])
    op.create_index("ix_quote_enquiry_customer_created", "quote_enquiry", ["customer_id", "created_at", "id"])
    op.create_index("ix_quote_enquiry_artist_created", "quote_enquiry", ["artist_id", "created_at", "id"])
    op.create_index(
        "uq_quote_enquiry_live_customer_artist",
        "quote_enquiry",
        ["customer_id", "artist_id"],
        unique=True,
        postgresql_where=sa.text("status IN ('open', 'quoted')"),
    )


def downgrade() -> None:
    op.drop_index("uq_quote_enquiry_live_customer_artist", table_name="quote_enquiry")
    op.drop_index("ix_quote_enquiry_artist_created", table_name="quote_enquiry")
    op.drop_index("ix_quote_enquiry_customer_created", table_name="quote_enquiry")
    op.drop_index("ix_quote_enquiry_status", table_name="quote_enquiry")
    op.drop_table("quote_enquiry")
    status.drop(op.get_bind(), checkfirst=False)
