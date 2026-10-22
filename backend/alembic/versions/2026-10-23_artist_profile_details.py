"""Artist profile details for the storefront: years of experience and the languages the artist speaks.

Revision ID: 9d4b7e2c1f85
Revises: 6c1e9b4d2a73
Create Date: 2026-10-23
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "9d4b7e2c1f85"
down_revision: str | Sequence[str] | None = "6c1e9b4d2a73"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("artist_profile", sa.Column("experience_years", sa.SmallInteger(), nullable=True))
    op.add_column(
        "artist_profile",
        sa.Column("languages", postgresql.ARRAY(sa.String(length=20)), server_default=sa.text("'{}'"), nullable=False),
    )


def downgrade() -> None:
    op.drop_column("artist_profile", "languages")
    op.drop_column("artist_profile", "experience_years")
