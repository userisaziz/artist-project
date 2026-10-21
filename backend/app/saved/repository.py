"""Queries over saved items. Which targets customers may see comes from the owning domains' own predicates."""

import uuid
from datetime import datetime

from sqlalchemy import Select, delete, exists, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.artist.models import ArtistProfile
from app.feed import repository as feed_repository
from app.feed.models import Post
from app.saved.constants import SavedKind
from app.saved.models import SavedItem
from app.shared.pagination import keyset
from app.shop import repository as shop_repository
from app.shop.models import Product

TARGET_ID = {SavedKind.post: Post.id, SavedKind.artist: ArtistProfile.id, SavedKind.product: Product.id}


def visible_ids(kind: SavedKind) -> Select:
    """Ids of the targets of `kind` a customer can see right now (feed VISIBLE, approved, shop ON_SALE)."""
    if kind == SavedKind.post:
        return select(Post.id).join(ArtistProfile, ArtistProfile.id == Post.artist_id).where(feed_repository.VISIBLE)
    if kind == SavedKind.artist:
        return select(ArtistProfile.id).where(feed_repository.ARTIST_VISIBLE)
    return select(Product.id).join(ArtistProfile, ArtistProfile.id == Product.artist_id).where(shop_repository.ON_SALE)


class SavedRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def is_visible(self, kind: SavedKind, target_id: uuid.UUID) -> bool:
        query = visible_ids(kind).where(TARGET_ID[kind] == target_id)
        return await self.session.scalar(select(exists(query))) or False

    async def save(self, user_id: uuid.UUID, kind: SavedKind, target_id: uuid.UUID) -> None:
        """Saving again keeps the first saved_at."""
        await self.session.execute(
            insert(SavedItem).values(user_id=user_id, kind=kind, target_id=target_id).on_conflict_do_nothing()
        )

    async def unsave(self, user_id: uuid.UUID, kind: SavedKind, target_id: uuid.UUID) -> None:
        await self.session.execute(
            delete(SavedItem).where(
                SavedItem.user_id == user_id, SavedItem.kind == kind, SavedItem.target_id == target_id
            )
        )

    async def all_ids(self, user_id: uuid.UUID) -> list[tuple[SavedKind, uuid.UUID]]:
        """(kind, target id) of everything saved, newest first, visible or not."""
        query = (
            select(SavedItem.kind, SavedItem.target_id)
            .where(SavedItem.user_id == user_id)
            .order_by(SavedItem.saved_at.desc(), SavedItem.target_id.desc())
        )
        return [(r.kind, r.target_id) for r in (await self.session.execute(query)).all()]

    async def visible_page(
        self, user_id: uuid.UUID, kind: SavedKind, *, limit: int, cursor: str | None
    ) -> list[tuple[uuid.UUID, datetime]]:
        """(target id, saved_at) of visible saved targets, newest-saved first, keyset on (saved_at, target_id),
        `limit + 1` rows."""
        query = select(SavedItem.target_id, SavedItem.saved_at).where(
            SavedItem.user_id == user_id, SavedItem.kind == kind, SavedItem.target_id.in_(visible_ids(kind))
        )
        query = keyset(query, SavedItem.saved_at, SavedItem.target_id, descending=True, cursor=cursor)
        return [(r.target_id, r.saved_at) for r in (await self.session.execute(query.limit(limit + 1))).all()]

    async def forget(self, user_id: uuid.UUID) -> None:
        await self.session.execute(delete(SavedItem).where(SavedItem.user_id == user_id))
