"""Artist profile location: area, pincode and a private studio / house no. from the onboarding Location step.

Revision ID: 9c4e7a1b3d58
Revises: 3d6f8a2c5e71
Create Date: 2026-10-22
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "9c4e7a1b3d58"
down_revision: str | Sequence[str] | None = "3d6f8a2c5e71"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("artist_profile", sa.Column("locality", sa.String(length=80), nullable=True))
    op.add_column("artist_profile", sa.Column("pincode", sa.String(length=6), nullable=True))
    op.add_column("artist_profile", sa.Column("address_line", sa.String(length=120), nullable=True))


def downgrade() -> None:
    op.drop_column("artist_profile", "address_line")
    op.drop_column("artist_profile", "pincode")
    op.drop_column("artist_profile", "locality")
