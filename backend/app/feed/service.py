"""Feed: approved artists publish photo sets and articles; customers read the feed, like posts and follow
artists. Posts of artists who are no longer approved disappear (404), like the storefront."""

import uuid
from datetime import timedelta
from typing import Any

from sqlalchemy import ColumnElement
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.booking.service import approved_artist_id
from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.feed.constants import (
    CAPTION_MAX,
    MAX_PHOTOS,
    RECENT_DAYS,
    TITLE_MIN,
    AdminFeedView,
    FeedTab,
    Moderation,
    ModerationDecision,
    PostKind,
    PostTopic,
)
from app.feed.models import Post, PostPhoto
from app.feed.repository import NOT_FEATURED, OPEN_REPORTS, VISIBLE, FeedRepository, PostRow, followed_by
from app.feed.schemas import PhotoIn, PostIn
from app.feed.utils import excerpt, read_minutes
from app.review import filters as review_filters
from app.review import service as review_service
from app.shared.clock import Clock
from app.shared.pagination import split_page
from app.upload.service import ImageStorage
from app.user.models import User

DEFAULT_TOPIC = {PostKind.photos: PostTopic.look, PostKind.article: PostTopic.guide}


class FeedService:
    def __init__(self, session: AsyncSession, storage: ImageStorage, clock: Clock):
        self.session = session
        self.posts = FeedRepository(session)
        self.storage = storage
        self.clock = clock

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
            "featured": p.featured_at is not None,
            "moderation": p.moderation,
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
            if data.cover or data.title:
                raise ValidationError("Photo posts have photos and a caption, no cover or title")
        else:
            if not data.title or len(data.title) < TITLE_MIN:
                raise ValidationError("An article needs a title")
            if data.photos:
                raise ValidationError("Articles have a cover photo, not a photo set")
        images = [*data.photos, *([data.cover] if data.cover else [])]
        if len({p.key for p in images}) != len(images):
            raise ValidationError("Each photo can be used once")
        for photo in images:
            self._check_key(user, photo)
        if await self.posts.any_key_in_use([p.key for p in images]):
            raise ConflictError("That photo is already used in another post")
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
        try:
            await self.session.flush()
        except IntegrityError as exc:  # uq on cover_key / storage_key: the image is already another post's
            raise ConflictError("That photo is already used in another post") from exc
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
        else:  # For you: featured posts lead the first page, so the newest-first pages skip them
            where.append(NOT_FEATURED)
        rows = await self.posts.page_rows(reader.id, where, limit=limit, cursor=cursor)
        page, next_cursor = split_page(rows, limit, lambda r: (r.post.created_at, r.post.id))
        if tab == "for_you" and cursor is None:
            page = [*await self.posts.featured_rows(reader.id, limit), *page]
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
        count = await (self.posts.like(post_id, reader.id) if liked else self.posts.unlike(post_id, reader.id))
        return {"liked": liked, "like_count": count}

    async def set_follow(self, reader: User, artist_id: uuid.UUID, following: bool) -> dict[str, Any]:
        if not await self.posts.is_visible_artist(artist_id):
            raise NotFoundError("Artist not found")
        if following:
            await self.posts.follow(reader.id, artist_id)
        else:
            await self.posts.unfollow(reader.id, artist_id)
        return {"following": following}

    async def report(self, reader: User, post_id: uuid.UUID, reason: str) -> None:
        """One report per person per post; reporting again changes nothing."""
        await self.visible_post(reader, post_id)
        await self.posts.report(post_id, reader.id, reason)

    # --- admin ------------------------------------------------------------------------------------

    def _admin(self, shaped: dict[str, Any], row: PostRow) -> dict[str, Any]:
        return {**shaped, "report_count": row.report_count, "moderation_note": row.post.moderation_note}

    async def _admin_out(self, rows: list[PostRow]) -> list[dict[str, Any]]:
        shaped = await self._out(rows, full=True)
        return [self._admin(s, r) for s, r in zip(shaped, rows, strict=True)]

    async def admin_list(self, view: AdminFeedView, limit: int, cursor: str | None):
        where: list[ColumnElement[bool]]
        if view == "featured":
            where = [Post.featured_at.is_not(None)]
        elif view == "reported":
            where = [Post.moderation == Moderation.live, OPEN_REPORTS > 0]
        elif view == "hidden":
            where = [Post.moderation == Moderation.hidden]
        else:
            where = [Post.moderation != Moderation.removed]
        rows = await self.posts.page_rows(None, where, limit=limit, cursor=cursor)
        page, next_cursor = split_page(rows, limit, lambda r: (r.post.created_at, r.post.id))
        return await self._admin_out(page), next_cursor

    async def admin_summary(self, slots: int) -> dict[str, Any]:
        counts = await self.posts.admin_counts(self.clock.now() - timedelta(days=RECENT_DAYS))
        recent = counts.pop("recent")
        return {"counts": counts, "posts_7d": recent, "featured_slots": slots}

    async def _admin_post(self, post_id: uuid.UUID) -> dict[str, Any]:
        row = await self.posts.row(None, post_id)
        if row is None:
            raise NotFoundError("Post not found")
        return (await self._admin_out([row]))[0]

    async def _locked(self, post_id: uuid.UUID) -> Post:
        post = await self.posts.locked(post_id)
        if post is None:
            raise NotFoundError("Post not found")
        return post

    async def moderate(self, post_id: uuid.UUID, decision: ModerationDecision, note: str | None) -> dict[str, Any]:
        """keep: live, open reports resolved. hide: out of the feed (the artist still sees it). remove: final."""
        post = await self._locked(post_id)
        if post.moderation == Moderation.removed:
            raise ConflictError("This post was removed")
        if decision == "keep":
            post.moderation = Moderation.live
            await self.posts.resolve_reports(post.id, self.clock.now())
        else:
            post.moderation = Moderation.hidden if decision == "hide" else Moderation.removed
            post.featured_at = None
        if note is not None:  # omitted keeps the note; an empty one clears it
            post.moderation_note = note or None
        await self.session.flush()
        return await self._admin_post(post_id)

    async def set_featured(self, post_id: uuid.UUID, featured: bool, slots: int) -> dict[str, Any]:
        post = await self._locked(post_id)
        if featured and post.featured_at is None:
            if post.moderation != Moderation.live:
                raise ConflictError("Only live posts can be featured")
            if await self.posts.featured_count() >= slots:
                raise ConflictError(f"All {slots} featured slots are taken. Unfeature a post first.")
            post.featured_at = self.clock.now()
        elif not featured:
            post.featured_at = None
        await self.session.flush()
        return await self._admin_post(post_id)
