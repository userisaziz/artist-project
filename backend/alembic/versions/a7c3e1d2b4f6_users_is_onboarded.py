"""users.is_onboarded

Revision ID: a7c3e1d2b4f6
Revises: f30be5e91b20
Create Date: 2026-10-10 10:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a7c3e1d2b4f6"
down_revision: str | Sequence[str] | None = "f30be5e91b20"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    # Written by hand: autogenerate would also drop the profile/service tables we no longer model.
    op.add_column("users", sa.Column("is_onboarded", sa.Boolean(), server_default=sa.false(), nullable=False))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("users", "is_onboarded")
