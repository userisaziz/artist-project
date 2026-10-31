"""Admin broadcasts: an immutable record of every push announcement sent from the console.

Revision ID: c5a9d7e3f2b8
Revises: 3f8a1c6d2b49
Create Date: 2026-10-31
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "c5a9d7e3f2b8"
down_revision: str | Sequence[str] | None = "3f8a1c6d2b49"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

NOW = sa.text("now()")


def upgrade() -> None:
    op.create_table(
        "notification_broadcast",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("title", sa.String(120), nullable=False),
        sa.Column("body", sa.String(300), nullable=False),
        sa.Column("link", sa.String(200), nullable=True),
        sa.Column("segment", sa.String(20), nullable=False),
        sa.Column("filters", postgresql.JSONB, server_default=sa.text("'{}'"), nullable=False),
        sa.Column("recipient_count", sa.Integer(), nullable=False),
        sa.Column("push_count", sa.Integer(), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=NOW, nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=NOW, nullable=False),
        sa.ForeignKeyConstraint(
            ["created_by"],
            ["user_account.id"],
            name=op.f("fk_notification_broadcast_created_by_user_account"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_notification_broadcast")),
    )
    op.create_index("ix_notification_broadcast_created_at", "notification_broadcast", ["created_at", "id"])


def downgrade() -> None:
    op.drop_index("ix_notification_broadcast_created_at", table_name="notification_broadcast")
    op.drop_table("notification_broadcast")
