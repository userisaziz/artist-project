"""Artist posts (photo sets and articles), their photos, customers' likes and follows."""

import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.feed.constants import TITLE_MAX, PostKind, PostTopic
from app.shared.models import Base, TimestampMixin

post_kind_enum = Enum(PostKind, name="feed_post_kind", values_callable=lambda e: [m.value for m in e])
post_topic_enum = Enum(PostTopic, name="feed_post_topic", values_callable=lambda e: [m.value for m in e])


class Post(Base, TimestampMixin):
    """`text` is the caption of a photo set or the body of an article (blank-line paragraphs, `## ` headings,
    `> ` quotes). A linked service puts "Book this look" on the post."""

    __tablename__ = "feed_post"
    __mapper_args__ = {"eager_defaults": True}

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
    )
    artist_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("artist_profile.id", ondelete="CASCADE"), nullable=False
    )
    kind: Mapped[PostKind] = mapped_column(post_kind_enum, nullable=False)
    topic: Mapped[PostTopic] = mapped_column(post_topic_enum, nullable=False)
    title: Mapped[str | None] = mapped_column(String(TITLE_MAX))
    text: Mapped[str] = mapped_column(Text, nullable=False)
    cover_key: Mapped[str | None] = mapped_column(String(255))
    cover_width: Mapped[int | None] = mapped_column(Integer)
    cover_height: Mapped[int | None] = mapped_column(Integer)
    service_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("artist_service_item.id", ondelete="SET NULL")
    )
    # Kept by the like/unlike statements (only when a row actually changes), so cards never count likes.
    like_count: Mapped[int] = mapped_column(Integer, default=0, server_default=sa.text("0"), nullable=False)
    photos: Mapped[list["PostPhoto"]] = relationship(
        lazy="selectin", cascade="all, delete-orphan", order_by="PostPhoto.sort_order"
    )

    __table_args__ = (
        sa.Index("ix_feed_post_created", "created_at", "id"),
        sa.Index("ix_feed_post_artist_created", "artist_id", "created_at", "id"),
        sa.Index("ix_feed_post_article_created", "created_at", "id", postgresql_where=sa.text("kind = 'article'")),
        # An image belongs to one post, so deleting a post can delete its images.
        sa.Index("uq_feed_post_cover_key", "cover_key", unique=True),
        sa.CheckConstraint("kind <> 'article' OR title IS NOT NULL", name="article_has_title"),
        sa.CheckConstraint("like_count >= 0", name="like_count_non_negative"),
    )


class PostPhoto(Base):
    __tablename__ = "feed_post_photo"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
    )
    post_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("feed_post.id", ondelete="CASCADE"), nullable=False, index=True
    )
    storage_key: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    width: Mapped[int] = mapped_column(Integer, nullable=False)
    height: Mapped[int] = mapped_column(Integer, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False)


class PostLike(Base):
    __tablename__ = "feed_post_like"

    post_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("feed_post.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("user_account.id", ondelete="CASCADE"), primary_key=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class ArtistFollow(Base):
    __tablename__ = "feed_artist_follow"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("user_account.id", ondelete="CASCADE"), primary_key=True
    )
    artist_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("artist_profile.id", ondelete="CASCADE"), primary_key=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
