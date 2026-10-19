"""Feed: approved artists publish photo sets and articles; customers read the feed, like posts and follow
artists. Posts of artists who are no longer approved disappear (404), like the storefront."""

import uuid
from typing import Any

from sqlalchemy import ColumnElement
from sqlalchemy.ext.asyncio import AsyncSession

from app.booking.service import approved_artist_id
from app.core.exceptions import NotFoundError, ValidationError
from app.feed.constants import CAPTION_MAX, MAX_PHOTOS, TITLE_MIN, FeedTab, PostKind, PostTopic
from app.feed.models import Post, PostPhoto
from app.feed.repository import VISIBLE, FeedRepository, PostRow, followed_by
from app.feed.schemas import PhotoIn, PostIn
from app.feed.utils import excerpt, read_minutes
from app.review import filters as review_filters
from app.review import service as review_service
from app.shared.pagination import split_page
from app.upload.service import ImageStorage
from app.user.models import User

DEFAULT_TOPIC = {PostKind.photos: PostTopic.look, PostKind.article: PostTopic.guide}


class FeedService:
    def __init__(self, session: AsyncSession, storage: ImageStorage):
        self.session = session
        self.posts = FeedRepository(session)
        self.storage = storage

    # --- shaping --------------------------------------------------------------------------------

    async def _out(self, rows: list[PostRow], *, full: bool) -> list[dict[str, Any]]:
        """Cards (or full posts) for `rows`, with linked services and artist ratings fetched in one go each."""
        services = await self.posts.services([r.post.service_id for r in rows if r.post.service_id])
        ratings = await review_service.ratings_for(self.session, list({r.post.artist_id for r in rows}))
        return [self._shape(r, services, ratings, full=full) for r in rows]

    def _shape(self, row: PostRow, services: dict, ratings: dict, *, full: bool) -> dict[str, Any]:
        p = row.post
        article = p.kind == PostKind.article
        service = services.get(p.service_id) if p.service_id else None
        average, count = ratings.get(p.artist_id, (None, 0))
        return {
            "id": p.id,
            "kind": p.kind,
            "topic": p.topic,
            "title": p.title,
            "text": None if article else p.text,
            "excerpt": excerpt(p.text) if article else None,
            "body": p.text if article and full else None,
            "read_minutes": read_minutes(p.text) if article else None,
            "cover_url": self.storage.url(p.cover_key, "full") if p.cover_key else None,
            "photos": [
                {"url": self.storage.url(ph.storage_key, "full"), "width": ph.width, "height": ph.height}
                for ph in p.photos
            ],
            "artist": {
                "id": p.artist_id,
                "business_name": row.business_name,
                "photo_url": self.storage.url(row.photo_key, "thumb") if row.photo_key else None,
                "city": row.city,
                "rating_average": average,
                "rating_count": count,
            },
            "service": {"id": service.id, "name": service.display_name, "price_paise": service.price_paise}
            if service
            else None,
            "like_count": row.like_count,
            "liked": row.liked,
            "following": row.following,
            "created_at": p.created_at,
        }

    # --- artist ---------------------------------------------------------------------------------

    def _check_key(self, user: User, photo: PhotoIn) -> None:
        if not self.storage.owns(photo.key, user.id, "post"):
            raise ValidationError("Invalid photo key")

    async def _check(self, user: User, artist_id: uuid.UUID, data: PostIn) -> None:
        """Domain rules the schema can't express (kind-specific fields, ownership, the contact filter)."""
        if data.kind == PostKind.photos:
            if not 1 <= len(data.photos) <= MAX_PHOTOS:
                raise ValidationError(f"A photo post needs 1 to {MAX_PHOTOS} photos")
            if len(data.text) > CAPTION_MAX:
                raise ValidationError(f"Captions stop at {CAPTION_MAX} characters")
        elif not data.title or len(data.title) < TITLE_MIN:
            raise ValidationError("An article needs a title")
        for photo in [*data.photos, *([data.cover] if data.cover else [])]:
            self._check_key(user, photo)
        if data.service_id and not await self.posts.bookable_service(data.service_id, artist_id):
            raise ValidationError("Link one of your own approved services")
        if review_filters.review_flag(f"{data.title or ''}\n{data.text}"):
            raise ValidationError("Posts can't include phone numbers, emails, links or blocked words")

    async def create(self, user: User, data: PostIn) -> dict[str, Any]:
        artist_id = await approved_artist_id(self.session, user)
        await self._check(user, artist_id, data)
        article = data.kind == PostKind.article
        post = Post(
            artist_id=artist_id,
            kind=data.kind,
            topic=data.topic or DEFAULT_TOPIC[data.kind],
            title=data.title if article else None,
            text=data.text,
            cover_key=data.cover.key if data.cover else None,
            cover_width=data.cover.width if data.cover else None,
            cover_height=data.cover.height if data.cover else None,
            service_id=data.service_id,
            photos=[
                PostPhoto(storage_key=ph.key, width=ph.width, height=ph.height, sort_order=i)
                for i, ph in enumerate(data.photos)
            ],
        )
        self.posts.add(post)
        await self.session.flush()
        row = await self.posts.row(None, post.id)
        return (await self._out([row], full=True))[0]

    async def mine(self, user: User, limit: int, cursor: str | None):
        artist_id = await approved_artist_id(self.session, user)
        rows = await self.posts.page_rows(None, [Post.artist_id == artist_id], limit=limit, cursor=cursor)
        page, next_cursor = split_page(rows, limit, lambda r: (r.post.created_at, r.post.id))
        return await self._out(page, full=True), next_cursor

    async def delete(self, user: User, post_id: uuid.UUID) -> None:
        post = await self.posts.own_post(post_id, await approved_artist_id(self.session, user))
        if post is None:
            raise NotFoundError("Post not found")
        keys = [ph.storage_key for ph in post.photos] + ([post.cover_key] if post.cover_key else [])
        await self.posts.delete(post)
        await self.session.flush()
        for key in keys:  # after the row is gone; a failed delete only leaves an orphaned image
            await self.storage.delete(key)

    # --- customer -------------------------------------------------------------------------------

    async def feed(self, reader: User, tab: FeedTab, limit: int, cursor: str | None):
        where: list[ColumnElement[bool]] = [VISIBLE]
        if tab == "following":
            where.append(followed_by(reader.id))
        elif tab == "stories":
            where.append(Post.kind == PostKind.article)
        rows = await self.posts.page_rows(reader.id, where, limit=limit, cursor=cursor)
        page, next_cursor = split_page(rows, limit, lambda r: (r.post.created_at, r.post.id))
        return await self._out(page, full=False), next_cursor

    async def visible_post(self, reader: User, post_id: uuid.UUID) -> PostRow:
        row = await self.posts.row(reader.id, post_id, VISIBLE)
        if row is None:
            raise NotFoundError("Post not found")
        return row

    async def detail(self, reader: User, post_id: uuid.UUID) -> dict[str, Any]:
        return (await self._out([await self.visible_post(reader, post_id)], full=True))[0]

    async def set_like(self, reader: User, post_id: uuid.UUID, liked: bool) -> dict[str, Any]:
        await self.visible_post(reader, post_id)
        if liked:
            await self.posts.like(post_id, reader.id)
        else:
            await self.posts.unlike(post_id, reader.id)
        return {"liked": liked, "like_count": await self.posts.like_count(post_id)}

    async def set_follow(self, reader: User, artist_id: uuid.UUID, following: bool) -> dict[str, Any]:
        if not await self.posts.is_visible_artist(artist_id):
            raise NotFoundError("Artist not found")
        if following:
            await self.posts.follow(reader.id, artist_id)
        else:
            await self.posts.unfollow(reader.id, artist_id)
        return {"following": following}
