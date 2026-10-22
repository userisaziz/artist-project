"""Artist profile coordinates: the Location step's GPS pin, so Explore can sort by distance.

Revision ID: 7e2a9c4d1f63
Revises: 9c4e7a1b3d58
Create Date: 2026-10-22
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "7e2a9c4d1f63"
down_revision: str | Sequence[str] | None = "9c4e7a1b3d58"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("artist_profile", sa.Column("latitude", sa.Float(), nullable=True))
    op.add_column("artist_profile", sa.Column("longitude", sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column("artist_profile", "longitude")
    op.drop_column("artist_profile", "latitude")
