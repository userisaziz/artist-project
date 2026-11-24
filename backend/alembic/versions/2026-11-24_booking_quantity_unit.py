"""Bookings and enquiries keep the unit their quantity counts in (person, piece, box…), as booked.

Revision ID: 3c9e7d2a1b54
Revises: 8b2f6a1c9d03
Create Date: 2026-11-24
"""

import sqlalchemy as sa

from alembic import op

revision = "3c9e7d2a1b54"
down_revision = "8b2f6a1c9d03"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("booking", sa.Column("quantity_unit", sa.String(length=10), nullable=True))
    op.add_column("quote_enquiry", sa.Column("quantity_unit", sa.String(length=10), nullable=True))
    # Bookings already per person (the only unit before this) say so.
    op.execute("UPDATE booking SET quantity_unit = 'person' WHERE quantity > 1")


def downgrade() -> None:
    op.drop_column("quote_enquiry", "quantity_unit")
    op.drop_column("booking", "quantity_unit")
