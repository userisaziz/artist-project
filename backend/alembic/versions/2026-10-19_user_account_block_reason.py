"""When and why an admin blocked an account (is_active false).

Revision ID: 9d4e2b6f1a38
Revises: 6f1b3d8a2c45
Create Date: 2026-10-19
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "9d4e2b6f1a38"
down_revision: str | Sequence[str] | None = "6f1b3d8a2c45"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("user_account", sa.Column("blocked_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("user_account", sa.Column("blocked_reason", sa.String(length=500), nullable=True))


def downgrade() -> None:
    op.drop_column("user_account", "blocked_reason")
    op.drop_column("user_account", "blocked_at")
