"""Admin category management. Categories in use are deactivated rather than deleted,
so existing artists and services keep a valid reference."""

import re

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.models.artist import ArtistServiceItem, artist_categories
from app.models.category import Category
from app.schemas.category import AdminCategoryOut, CategoryIn, CategoryPatch


def slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


class CategoryService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def _usage(self, category_id: int | None = None) -> dict[int, tuple[int, int]]:
        """category_id → (artist_count, service_count)."""
        artists = select(artist_categories.c.category_id, func.count()).group_by(artist_categories.c.category_id)
        services = select(ArtistServiceItem.category_id, func.count()).group_by(ArtistServiceItem.category_id)
        if category_id is not None:
            artists = artists.where(artist_categories.c.category_id == category_id)
            services = services.where(ArtistServiceItem.category_id == category_id)
        a = dict((await self.session.execute(artists)).all())
        s = dict((await self.session.execute(services)).all())
        return {cid: (a.get(cid, 0), s.get(cid, 0)) for cid in a.keys() | s.keys()}

    def _out(self, category: Category, usage: dict[int, tuple[int, int]]) -> AdminCategoryOut:
        artist_count, service_count = usage.get(category.id, (0, 0))
        return AdminCategoryOut(
            id=category.id, slug=category.slug, name=category.name, sort_order=category.sort_order,
            is_active=category.is_active, artist_count=artist_count, service_count=service_count,
        )

    async def _get(self, category_id: int) -> Category:
        category = await self.session.get(Category, category_id)
        if category is None:
            raise NotFoundError("Category not found")
        return category

    async def _ensure_unique(self, slug: str, name: str, exclude_id: int | None = None) -> None:
        query = select(Category.id).where(
            (Category.slug == slug) | (func.lower(Category.name) == name.lower())
        )
        if exclude_id is not None:
            query = query.where(Category.id != exclude_id)
        if await self.session.scalar(query.limit(1)):
            raise ConflictError("A category with that name or slug already exists")

    async def list(self) -> list[AdminCategoryOut]:
        rows = (await self.session.scalars(select(Category).order_by(Category.sort_order, Category.id))).all()
        usage = await self._usage()
        return [self._out(c, usage) for c in rows]

    async def create(self, body: CategoryIn) -> AdminCategoryOut:
        name = body.name.strip()
        slug = body.slug or slugify(name)
        if not slug:
            raise ValidationError("Name needs at least one letter or digit")
        await self._ensure_unique(slug, name)
        sort_order = body.sort_order
        if sort_order is None:
            sort_order = await self.session.scalar(select(func.coalesce(func.max(Category.sort_order) + 1, 0)))
        category = Category(name=name, slug=slug, sort_order=sort_order, is_active=body.is_active)
        self.session.add(category)
        await self.session.flush()
        return self._out(category, {})

    async def update(self, category_id: int, body: CategoryPatch) -> AdminCategoryOut:
        category = await self._get(category_id)
        changes = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
        if "name" in changes:
            changes["name"] = changes["name"].strip()
        if "name" in changes or "slug" in changes:
            await self._ensure_unique(changes.get("slug", category.slug), changes.get("name", category.name), category.id)
        for field, value in changes.items():
            setattr(category, field, value)
        await self.session.flush()
        return self._out(category, await self._usage(category.id))

    async def delete(self, category_id: int) -> None:
        category = await self._get(category_id)
        artist_count, service_count = (await self._usage(category.id)).get(category.id, (0, 0))
        if artist_count or service_count:
            raise ConflictError("Category is in use; deactivate it instead")
        await self.session.delete(category)
        await self.session.flush()
