"""User saved addresses: up to 10 labelled addresses per account, most recently used first.

Revision ID: 5b8e2c4f9a17
Revises: adf2d3a8cea4
Create Date: 2026-10-21
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "5b8e2c4f9a17"
down_revision: str | Sequence[str] | None = "adf2d3a8cea4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "user_address",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("label", sa.String(length=40), nullable=False),
        sa.Column("address", sa.String(length=300), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["user_id"], ["user_account.id"], name="fk_user_address_user_id_user_account", ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name="pk_user_address"),
    )
    op.create_index("ix_user_address_user_id", "user_address", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_user_address_user_id", table_name="user_address")
    op.drop_table("user_address")
