"""Queries over posts, likes and follows. A card's counts and the reader's like/follow flags come from SQL;
shaping stays in the service."""

import uuid
from collections.abc import Sequence
from datetime import datetime
from typing import NamedTuple

from sqlalchemy import ColumnElement, Select, and_, delete, exists, func, literal, or_, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.artist.models import ArtistProfile, ArtistServiceItem
from app.feed.constants import Moderation
from app.feed.models import ArtistFollow, Post, PostLike, PostPhoto, PostReport
from app.shared.enums import ArtistServiceStatus, ArtistStatus
from app.shared.pagination import keyset
from app.shared.search import like_pattern

ARTIST_VISIBLE = ArtistProfile.status == ArtistStatus.approved
VISIBLE = and_(ARTIST_VISIBLE, Post.moderation == Moderation.live)  # what customers may see
NOT_FEATURED = Post.featured_at.is_(None)
OPEN_REPORTS = (
    select(func.count()).where(PostReport.post_id == Post.id, PostReport.resolved_at.is_(None)).scalar_subquery()
)


class PostRow(NamedTuple):
    post: Post
    business_name: str
    photo_key: str | None
    city: str
    like_count: int
    liked: bool
    following: bool
    report_count: int


def rows_query(reader_id: uuid.UUID | None) -> Select:
    """A post with its artist card, like count, and whether `reader_id` likes it and follows the artist."""
    liked = exists().where(PostLike.post_id == Post.id, PostLike.user_id == reader_id) if reader_id else literal(False)
    following = (
        exists().where(ArtistFollow.artist_id == Post.artist_id, ArtistFollow.user_id == reader_id)
        if reader_id
        else literal(False)
    )
    return select(
        Post,
        ArtistProfile.business_name,
        ArtistProfile.photo_key,
        ArtistProfile.city,
        Post.like_count,
        liked,
        following,
        OPEN_REPORTS,
    ).join(ArtistProfile, ArtistProfile.id == Post.artist_id)


def followed_by(user_id: uuid.UUID) -> ColumnElement[bool]:
    return Post.artist_id.in_(select(ArtistFollow.artist_id).where(ArtistFollow.user_id == user_id))


def matching(q: str) -> ColumnElement[bool]:
    """Search: the title, the caption or article text, or the artist's name (rows_query joins the artist)."""
    pattern = like_pattern(q)
    return or_(
        Post.title.ilike(pattern, escape="\\"),
        Post.text.ilike(pattern, escape="\\"),
        ArtistProfile.business_name.ilike(pattern, escape="\\"),
    )


class FeedRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def page_rows(
        self, reader_id: uuid.UUID | None, where: Sequence[ColumnElement[bool]], *, limit: int, cursor: str | None
    ) -> list[PostRow]:
        """Newest first, keyset on (created_at, id), `limit + 1` rows."""
        query = keyset(rows_query(reader_id).where(*where), Post.created_at, Post.id, descending=True, cursor=cursor)
        return [PostRow(*r) for r in (await self.session.execute(query.limit(limit + 1))).all()]

    async def row(self, reader_id: uuid.UUID | None, post_id: uuid.UUID, *scope: ColumnElement[bool]) -> PostRow | None:
        row = (await self.session.execute(rows_query(reader_id).where(Post.id == post_id, *scope))).one_or_none()
        return PostRow(*row) if row else None

    async def own_post(self, post_id: uuid.UUID, artist_id: uuid.UUID) -> Post | None:
        return await self.session.scalar(select(Post).where(Post.id == post_id, Post.artist_id == artist_id))

    async def artist_posts(self, artist_id: uuid.UUID) -> Sequence[Post]:
        return (await self.session.scalars(select(Post).where(Post.artist_id == artist_id))).all()

    async def services(self, service_ids: list[uuid.UUID]) -> dict[uuid.UUID, ArtistServiceItem]:
        if not service_ids:
            return {}
        rows = await self.session.scalars(
            select(ArtistServiceItem).where(
                ArtistServiceItem.id.in_(service_ids), ArtistServiceItem.status == ArtistServiceStatus.approved
            )
        )
        return {s.id: s for s in rows}

    async def bookable_service(self, service_id: uuid.UUID, artist_id: uuid.UUID) -> bool:
        found = await self.session.scalar(
            select(ArtistServiceItem.id).where(
                ArtistServiceItem.id == service_id,
                ArtistServiceItem.artist_id == artist_id,
                ArtistServiceItem.status == ArtistServiceStatus.approved,
            )
        )
        return found is not None

    async def any_key_in_use(self, keys: list[str]) -> bool:
        """Whether any of these image keys is already a post's photo or cover."""
        photo = select(PostPhoto.storage_key).where(PostPhoto.storage_key.in_(keys))
        cover = select(Post.cover_key).where(Post.cover_key.in_(keys))
        return await self.session.scalar(select(exists(photo.union_all(cover).subquery()))) or False

    async def is_visible_artist(self, artist_id: uuid.UUID) -> bool:
        found = await self.session.scalar(select(ArtistProfile.id).where(ArtistProfile.id == artist_id, ARTIST_VISIBLE))
        return found is not None

    async def like(self, post_id: uuid.UUID, user_id: uuid.UUID) -> int:
        """Adds the like if it's new; returns the post's like count."""
        added = await self.session.scalar(
            insert(PostLike)
            .values(post_id=post_id, user_id=user_id)
            .on_conflict_do_nothing()
            .returning(PostLike.post_id)
        )
        return await self._bump(post_id, 1 if added else 0)

    async def unlike(self, post_id: uuid.UUID, user_id: uuid.UUID) -> int:
        """Removes the like if there is one; returns the post's like count."""
        removed = await self.session.scalar(
            delete(PostLike).where(PostLike.post_id == post_id, PostLike.user_id == user_id).returning(PostLike.post_id)
        )
        return await self._bump(post_id, -1 if removed else 0)

    async def _bump(self, post_id: uuid.UUID, by: int) -> int:
        """One atomic UPDATE … RETURNING, so concurrent likes never lose a count."""
        return (
            await self.session.execute(
                update(Post)
                .where(Post.id == post_id)
                .values(like_count=Post.like_count + by)
                .returning(Post.like_count)
                .execution_options(synchronize_session=False)
            )
        ).scalar_one()

    async def follow(self, user_id: uuid.UUID, artist_id: uuid.UUID) -> None:
        await self.session.execute(
            insert(ArtistFollow).values(user_id=user_id, artist_id=artist_id).on_conflict_do_nothing()
        )

    async def unfollow(self, user_id: uuid.UUID, artist_id: uuid.UUID) -> None:
        await self.session.execute(
            delete(ArtistFollow).where(ArtistFollow.user_id == user_id, ArtistFollow.artist_id == artist_id)
        )

    async def featured_rows(self, reader_id: uuid.UUID | None, limit: int) -> list[PostRow]:
        """Visible featured posts, most recently featured first."""
        query = rows_query(reader_id).where(VISIBLE, Post.featured_at.is_not(None)).order_by(Post.featured_at.desc())
        return [PostRow(*r) for r in (await self.session.execute(query.limit(limit))).all()]

    async def featured_count(self) -> int:
        return (await self.session.execute(select(func.count()).where(Post.featured_at.is_not(None)))).scalar_one()

    async def locked(self, post_id: uuid.UUID) -> Post | None:
        return await self.session.scalar(select(Post).where(Post.id == post_id).with_for_update())

    async def report(self, post_id: uuid.UUID, user_id: uuid.UUID, reason: str) -> bool:
        """Whether this is a new report (a person's repeat report changes nothing)."""
        inserted = await self.session.scalar(
            insert(PostReport)
            .values(post_id=post_id, user_id=user_id, reason=reason)
            .on_conflict_do_nothing()
            .returning(PostReport.post_id)
        )
        return inserted is not None

    async def open_report_count(self, post_id: uuid.UUID) -> int:
        return (
            await self.session.execute(
                select(func.count()).where(PostReport.post_id == post_id, PostReport.resolved_at.is_(None))
            )
        ).scalar_one()

    async def resolve_reports(self, post_id: uuid.UUID, at: datetime) -> None:
        await self.session.execute(
            update(PostReport)
            .where(PostReport.post_id == post_id, PostReport.resolved_at.is_(None))
            .values(resolved_at=at)
            .execution_options(synchronize_session=False)
        )

    async def admin_counts(self, since: datetime) -> dict[str, int]:
        not_removed = Post.moderation != Moderation.removed
        row = (
            await self.session.execute(
                select(
                    func.count().filter(not_removed),
                    func.count().filter(Post.featured_at.is_not(None)),
                    func.count().filter(Post.moderation == Moderation.live, OPEN_REPORTS > 0),
                    func.count().filter(Post.moderation == Moderation.hidden),
                    func.count().filter(not_removed, Post.created_at >= since),
                ).select_from(Post)
            )
        ).one()
        return {"all": row[0], "featured": row[1], "reported": row[2], "hidden": row[3], "recent": row[4]}

    def add(self, post: Post) -> None:
        self.session.add(post)

    async def delete(self, post: Post) -> None:
        await self.session.delete(post)
