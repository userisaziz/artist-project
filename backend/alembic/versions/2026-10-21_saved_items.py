"""Saved: a customer's bookmarks on posts, artists and shop products. No FK to the target (three kinds).

Revision ID: adf2d3a8cea4
Revises: 13b3c7fe1c40
Create Date: 2026-10-21
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "adf2d3a8cea4"
down_revision: str | Sequence[str] | None = "13b3c7fe1c40"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

saved_item_kind = postgresql.ENUM("post", "artist", "product", name="saved_item_kind", create_type=False)


def upgrade() -> None:
    saved_item_kind.create(op.get_bind(), checkfirst=False)
    op.create_table(
        "saved_item",
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("kind", saved_item_kind, nullable=False),
        sa.Column("target_id", sa.UUID(), nullable=False),
        sa.Column("saved_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(
            ["user_id"], ["user_account.id"], name="fk_saved_item_user_id_user_account", ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("user_id", "kind", "target_id", name="pk_saved_item"),
    )
    op.create_index("ix_saved_item_user_kind_saved", "saved_item", ["user_id", "kind", sa.text("saved_at DESC")])


def downgrade() -> None:
    op.drop_index("ix_saved_item_user_kind_saved", table_name="saved_item")
    op.drop_table("saved_item")
    saved_item_kind.drop(op.get_bind(), checkfirst=False)
