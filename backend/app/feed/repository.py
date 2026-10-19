"""Queries over posts, likes and follows. A card's counts and the reader's like/follow flags come from SQL;
shaping stays in the service."""

import uuid
from collections.abc import Sequence
from typing import NamedTuple

from sqlalchemy import ColumnElement, Select, delete, exists, func, literal, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.artist.models import ArtistProfile, ArtistServiceItem
from app.feed.models import ArtistFollow, Post, PostLike
from app.shared.enums import ArtistServiceStatus, ArtistStatus
from app.shared.pagination import keyset

VISIBLE = ArtistProfile.status == ArtistStatus.approved


class PostRow(NamedTuple):
    post: Post
    business_name: str
    photo_key: str | None
    city: str
    like_count: int
    liked: bool
    following: bool


def like_count(post_id: ColumnElement) -> ColumnElement[int]:
    return select(func.count()).where(PostLike.post_id == post_id).scalar_subquery()


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
        like_count(Post.id),
        liked,
        following,
    ).join(ArtistProfile, ArtistProfile.id == Post.artist_id)


def followed_by(user_id: uuid.UUID) -> ColumnElement[bool]:
    return Post.artist_id.in_(select(ArtistFollow.artist_id).where(ArtistFollow.user_id == user_id))


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

    async def services(self, service_ids: list[uuid.UUID]) -> dict[uuid.UUID, ArtistServiceItem]:
        if not service_ids:
            return {}
        rows = await self.session.scalars(select(ArtistServiceItem).where(ArtistServiceItem.id.in_(service_ids)))
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

    async def is_visible_artist(self, artist_id: uuid.UUID) -> bool:
        found = await self.session.scalar(select(ArtistProfile.id).where(ArtistProfile.id == artist_id, VISIBLE))
        return found is not None

    async def like(self, post_id: uuid.UUID, user_id: uuid.UUID) -> None:
        await self.session.execute(insert(PostLike).values(post_id=post_id, user_id=user_id).on_conflict_do_nothing())

    async def unlike(self, post_id: uuid.UUID, user_id: uuid.UUID) -> None:
        await self.session.execute(delete(PostLike).where(PostLike.post_id == post_id, PostLike.user_id == user_id))

    async def like_count(self, post_id: uuid.UUID) -> int:
        return await self.session.scalar(select(like_count(literal(post_id))))

    async def follow(self, user_id: uuid.UUID, artist_id: uuid.UUID) -> None:
        await self.session.execute(
            insert(ArtistFollow).values(user_id=user_id, artist_id=artist_id).on_conflict_do_nothing()
        )

    async def unfollow(self, user_id: uuid.UUID, artist_id: uuid.UUID) -> None:
        await self.session.execute(
            delete(ArtistFollow).where(ArtistFollow.user_id == user_id, ArtistFollow.artist_id == artist_id)
        )

    def add(self, post: Post) -> None:
        self.session.add(post)

    async def delete(self, post: Post) -> None:
        await self.session.delete(post)
