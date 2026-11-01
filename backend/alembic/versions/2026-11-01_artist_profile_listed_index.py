"""Index the directory's keyset order: approved artists by when they were approved.

The public directory pages by (approved-at, id), and an artist with no approval timestamp stands in
with the day they joined. A plain btree cannot serve that ORDER BY — the expression is not a column
— so the page query sorted every match in memory. This index makes the expression the key, and the
keyset pages walk it.

Revision ID: e7b4c1a9d3f6
Revises: c5a9d7e3f2b8
Create Date: 2026-11-01
"""

from collections.abc import Sequence

from alembic import op

revision: str = "e7b4c1a9d3f6"
down_revision: str | Sequence[str] | None = "c5a9d7e3f2b8"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        "CREATE INDEX ix_artist_profile_listed ON artist_profile (status, coalesce(reviewed_at, created_at), id)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_artist_profile_listed")
