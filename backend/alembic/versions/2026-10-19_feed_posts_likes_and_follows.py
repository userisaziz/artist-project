"""Feed: artist posts (photo sets and articles), their photos, likes and follows.

Revision ID: 3c9e1a7d5f22
Revises: 8a4c6e2f9b17
Create Date: 2026-10-19
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "3c9e1a7d5f22"
down_revision: str | Sequence[str] | None = "8a4c6e2f9b17"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

post_kind = postgresql.ENUM("photos", "article", name="feed_post_kind", create_type=False)
post_topic = postgresql.ENUM("look", "guide", "story", name="feed_post_topic", create_type=False)
NOW = sa.text("now()")
NEW_ID = sa.text("gen_random_uuid()")


def upgrade() -> None:
    post_kind.create(op.get_bind(), checkfirst=False)
    post_topic.create(op.get_bind(), checkfirst=False)
    op.create_table(
        "feed_post",
        sa.Column("id", sa.UUID(), server_default=NEW_ID, nullable=False),
        sa.Column("artist_id", sa.UUID(), nullable=False),
        sa.Column("kind", post_kind, nullable=False),
        sa.Column("topic", post_topic, nullable=False),
        sa.Column("title", sa.String(length=140), nullable=True),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("cover_key", sa.String(length=255), nullable=True),
        sa.Column("cover_width", sa.Integer(), nullable=True),
        sa.Column("cover_height", sa.Integer(), nullable=True),
        sa.Column("service_id", sa.UUID(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=NOW, nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=NOW, nullable=False),
        sa.CheckConstraint("kind <> 'article' OR title IS NOT NULL", name="ck_feed_post_article_has_title"),
        sa.ForeignKeyConstraint(
            ["artist_id"], ["artist_profile.id"], name="fk_feed_post_artist_id_artist_profile", ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["service_id"],
            ["artist_service_item.id"],
            name="fk_feed_post_service_id_artist_service_item",
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_feed_post"),
    )
    op.create_index("ix_feed_post_created", "feed_post", ["created_at", "id"])
    op.create_index("ix_feed_post_artist_created", "feed_post", ["artist_id", "created_at", "id"])
    op.create_table(
        "feed_post_photo",
        sa.Column("id", sa.UUID(), server_default=NEW_ID, nullable=False),
        sa.Column("post_id", sa.UUID(), nullable=False),
        sa.Column("storage_key", sa.String(length=255), nullable=False),
        sa.Column("width", sa.Integer(), nullable=False),
        sa.Column("height", sa.Integer(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["post_id"], ["feed_post.id"], name="fk_feed_post_photo_post_id_feed_post", ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name="pk_feed_post_photo"),
    )
    op.create_index("ix_feed_post_photo_post_id", "feed_post_photo", ["post_id"])
    op.create_table(
        "feed_post_like",
        sa.Column("post_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=NOW, nullable=False),
        sa.ForeignKeyConstraint(
            ["post_id"], ["feed_post.id"], name="fk_feed_post_like_post_id_feed_post", ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["user_account.id"], name="fk_feed_post_like_user_id_user_account", ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("post_id", "user_id", name="pk_feed_post_like"),
    )
    op.create_table(
        "feed_artist_follow",
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("artist_id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=NOW, nullable=False),
        sa.ForeignKeyConstraint(
            ["artist_id"],
            ["artist_profile.id"],
            name="fk_feed_artist_follow_artist_id_artist_profile",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["user_account.id"], name="fk_feed_artist_follow_user_id_user_account", ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("user_id", "artist_id", name="pk_feed_artist_follow"),
    )
    op.create_index("ix_feed_artist_follow_artist_id", "feed_artist_follow", ["artist_id"])


def downgrade() -> None:
    op.drop_index("ix_feed_artist_follow_artist_id", table_name="feed_artist_follow")
    op.drop_table("feed_artist_follow")
    op.drop_table("feed_post_like")
    op.drop_index("ix_feed_post_photo_post_id", table_name="feed_post_photo")
    op.drop_table("feed_post_photo")
    op.drop_index("ix_feed_post_artist_created", table_name="feed_post")
    op.drop_index("ix_feed_post_created", table_name="feed_post")
    op.drop_table("feed_post")
    post_topic.drop(op.get_bind(), checkfirst=False)
    post_kind.drop(op.get_bind(), checkfirst=False)
