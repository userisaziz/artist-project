"""Feed moderation: a post's moderation state and note, featuring, and customers' reports.

Revision ID: 5e2b8d4f9a61
Revises: 4c8e2a6f1b37
Create Date: 2026-10-19
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "5e2b8d4f9a61"
down_revision: str | Sequence[str] | None = "4c8e2a6f1b37"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

moderation = postgresql.ENUM("live", "hidden", "removed", name="feed_post_moderation", create_type=False)


def upgrade() -> None:
    moderation.create(op.get_bind(), checkfirst=False)
    op.add_column("feed_post", sa.Column("moderation", moderation, server_default=sa.text("'live'"), nullable=False))
    op.add_column("feed_post", sa.Column("moderation_note", sa.String(length=500), nullable=True))
    op.add_column("feed_post", sa.Column("featured_at", sa.DateTime(timezone=True), nullable=True))
    op.create_table(
        "feed_post_report",
        sa.Column("post_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("reason", sa.String(length=30), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["post_id"], ["feed_post.id"], name="fk_feed_post_report_post_id_feed_post", ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["user_account.id"], name="fk_feed_post_report_user_id_user_account", ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("post_id", "user_id", name="pk_feed_post_report"),
    )


def downgrade() -> None:
    op.drop_table("feed_post_report")
    op.drop_column("feed_post", "featured_at")
    op.drop_column("feed_post", "moderation_note")
    op.drop_column("feed_post", "moderation")
    moderation.drop(op.get_bind(), checkfirst=False)
