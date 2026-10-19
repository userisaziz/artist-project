"""Feed: a stored like counter (backfilled), one post per image, and the Stories tab's index.

Revision ID: 6f1b3d8a2c45
Revises: 3c9e1a7d5f22
Create Date: 2026-10-19
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "6f1b3d8a2c45"
down_revision: str | Sequence[str] | None = "3c9e1a7d5f22"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("feed_post", sa.Column("like_count", sa.Integer(), server_default=sa.text("0"), nullable=False))
    op.execute(
        "UPDATE feed_post SET like_count = c.n "
        "FROM (SELECT post_id, count(*) AS n FROM feed_post_like GROUP BY post_id) AS c WHERE c.post_id = feed_post.id"
    )
    op.create_check_constraint(op.f("ck_feed_post_like_count_non_negative"), "feed_post", "like_count >= 0")
    op.create_index("uq_feed_post_cover_key", "feed_post", ["cover_key"], unique=True)
    op.create_unique_constraint("uq_feed_post_photo_storage_key", "feed_post_photo", ["storage_key"])
    op.create_index(
        "ix_feed_post_article_created",
        "feed_post",
        ["created_at", "id"],
        postgresql_where=sa.text("kind = 'article'"),
    )


def downgrade() -> None:
    op.drop_index("ix_feed_post_article_created", table_name="feed_post")
    op.drop_constraint("uq_feed_post_photo_storage_key", "feed_post_photo", type_="unique")
    op.drop_index("uq_feed_post_cover_key", table_name="feed_post")
    op.drop_constraint("ck_feed_post_like_count_non_negative", "feed_post", type_="check")
    op.drop_column("feed_post", "like_count")
