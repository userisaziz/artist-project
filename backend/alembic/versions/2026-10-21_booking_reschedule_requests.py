"""Booking reschedule requests: the customer's pending ask to move a booking, and the artist's last decline reason.

Revision ID: 9c4e7a1d3b52
Revises: 5b8e2c4f9a17
Create Date: 2026-10-21
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "9c4e7a1d3b52"
down_revision: str | Sequence[str] | None = "5b8e2c4f9a17"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TIMESTAMPS = ("reschedule_start_at", "reschedule_end_at", "reschedule_requested_at", "reschedule_expires_at")


def upgrade() -> None:
    for column in TIMESTAMPS:
        op.add_column("booking", sa.Column(column, sa.DateTime(timezone=True), nullable=True))
    op.add_column("booking", sa.Column("reschedule_declined_reason", sa.String(length=500), nullable=True))
    op.create_check_constraint(
        op.f("ck_booking_reschedule_all_or_none"),
        "booking",
        "(reschedule_start_at IS NULL AND reschedule_end_at IS NULL AND reschedule_requested_at IS NULL "
        "AND reschedule_expires_at IS NULL) OR (reschedule_start_at IS NOT NULL AND reschedule_end_at IS NOT NULL "
        "AND reschedule_requested_at IS NOT NULL AND reschedule_expires_at IS NOT NULL)",
    )


def downgrade() -> None:
    op.drop_constraint(op.f("ck_booking_reschedule_all_or_none"), "booking", type_="check")
    op.drop_column("booking", "reschedule_declined_reason")
    for column in reversed(TIMESTAMPS):
        op.drop_column("booking", column)
