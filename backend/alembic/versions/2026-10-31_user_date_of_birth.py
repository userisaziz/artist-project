"""Date of birth on the account, asked at sign-up so the app can require an adult.

Revision ID: 3f8a1c6d2b49
Revises: 9d4b7e2c1f85
Create Date: 2026-10-31
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "3f8a1c6d2b49"
down_revision: str | Sequence[str] | None = "9d4b7e2c1f85"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Nullable: accounts created before this change simply have no date until they save their details again.
    op.add_column("user_account", sa.Column("date_of_birth", sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column("user_account", "date_of_birth")
