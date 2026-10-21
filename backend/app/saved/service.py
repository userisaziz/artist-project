"""Saved: a customer's bookmarks on posts, artists and shop products. Lists show only what customers can see
right now, shaped by the owning domain (so a saved post's liked/following flags are the reader's own)."""

import uuid
from collections.abc import Awaitable, Callable
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.directory import service as directory_service
from app.feed import service as feed_service
from app.saved.constants import SavedKind
from app.saved.repository import SavedRepository
from app.shared.clock import Clock
from app.shared.pagination import split_page
from app.shop import product_service
from app.upload.service import ImageStorage
from app.user.models import User

IDS_FIELD = {SavedKind.post: "posts", SavedKind.artist: "artists", SavedKind.product: "products"}


async def forget(session: AsyncSession, user_id: uuid.UUID) -> None:
    """Account deletion: every saved item of the person goes."""
    await SavedRepository(session).forget(user_id)


class SavedService:
    def __init__(self, session: AsyncSession, storage: ImageStorage, clock: Clock):
        self.session = session
        self.saved = SavedRepository(session)
        self.storage = storage
        self.clock = clock

    async def save(self, user: User, kind: SavedKind, target_id: uuid.UUID) -> None:
        if not await self.saved.is_visible(kind, target_id):
            raise NotFoundError("Not found")
        await self.saved.save(user.id, kind, target_id)

    async def unsave(self, user: User, kind: SavedKind, target_id: uuid.UUID) -> None:
        """No visibility check: unsaving something that is gone must work."""
        await self.saved.unsave(user.id, kind, target_id)

    async def ids(self, user: User) -> dict[str, list[uuid.UUID]]:
        out: dict[str, list[uuid.UUID]] = {field: [] for field in IDS_FIELD.values()}
        for kind, target_id in await self.saved.all_ids(user.id):
            out[IDS_FIELD[kind]].append(target_id)
        return out

    async def page(
        self, user: User, kind: SavedKind, limit: int, cursor: str | None
    ) -> tuple[list[dict[str, Any]], str | None]:
        """Newest-saved first; each item shaped by its own domain, in the saved order."""
        rows = await self.saved.visible_page(user.id, kind, limit=limit, cursor=cursor)
        page, next_cursor = split_page(rows, limit, lambda r: (r[1], r[0]))
        ids = [target_id for target_id, _ in page]
        cards = {card["id"]: card for card in await self._cards(user, kind)(ids)} if ids else {}
        return [cards[i] for i in ids if i in cards], next_cursor

    def _cards(self, user: User, kind: SavedKind) -> Callable[[list[uuid.UUID]], Awaitable[list[dict[str, Any]]]]:
        if kind == SavedKind.post:
            feed = feed_service.FeedService(self.session, self.storage, self.clock)
            return lambda ids: feed.cards(user, ids)
        if kind == SavedKind.artist:
            return directory_service.DirectoryService(self.session, self.storage, self.clock).cards
        return product_service.ProductService(self.session, self.storage).cards
