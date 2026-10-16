"""Admin category management, two levels deep: top-level categories and their subcategories.
Categories in use are made inactive rather than deleted, so existing artists, services and
templates keep a valid reference."""

import re
from typing import NamedTuple

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.models.artist import ArtistServiceItem, artist_categories
from app.models.category import Category
from app.models.service_template import ServiceTemplate
from app.schemas.category import AdminCategoryOut, CategoryIn, CategoryPatch
from app.utils.enums import CategoryStatus


def slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def siblings(parent_id: int | None):
    return Category.parent_id.is_(None) if parent_id is None else Category.parent_id == parent_id


class Usage(NamedTuple):
    artists: int = 0
    services: int = 0
    children: int = 0
    templates: int = 0


class CategoryService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def _usage(self, category_id: int | None = None) -> dict[int, Usage]:
        queries = (
            select(artist_categories.c.category_id, func.count()).group_by(artist_categories.c.category_id),
            select(ArtistServiceItem.category_id, func.count()).group_by(ArtistServiceItem.category_id),
            select(Category.parent_id, func.count()).where(Category.parent_id.is_not(None)).group_by(Category.parent_id),
            select(ServiceTemplate.subcategory_id, func.count()).group_by(ServiceTemplate.subcategory_id),
        )
        counts = []
        for query in queries:
            if category_id is not None:
                query = query.where(query.selected_columns[0] == category_id)
            counts.append(dict((await self.session.execute(query)).all()))
        return {cid: Usage(*(c.get(cid, 0) for c in counts)) for cid in set().union(*counts)}

    def _out(self, category: Category, usage: dict[int, Usage]) -> AdminCategoryOut:
        u = usage.get(category.id, Usage())
        return AdminCategoryOut(
            id=category.id, slug=category.slug, name=category.name, sort_order=category.sort_order,
            status=category.status, parent_id=category.parent_id, artist_count=u.artists,
            service_count=u.services, child_count=u.children, template_count=u.templates,
        )

    async def _get(self, category_id: int) -> Category:
        category = await self.session.get(Category, category_id)
        if category is None:
            raise NotFoundError("Category not found")
        return category

    async def _parent(self, parent_id: int) -> Category:
        parent = await self.session.get(Category, parent_id)
        if parent is None or parent.parent_id is not None:
            raise ValidationError("Subcategories can only sit under a top-level category")
        return parent

    async def _ensure_unique(self, slug: str, name: str, parent_id: int | None, exclude_id: int | None = None) -> None:
        """Slugs are unique everywhere; names only among siblings (two parents can each have "Bridal")."""
        query = select(Category.id).where(
            (Category.slug == slug) | ((func.lower(Category.name) == name.lower()) & siblings(parent_id))
        )
        if exclude_id is not None:
            query = query.where(Category.id != exclude_id)
        if await self.session.scalar(query.limit(1)):
            raise ConflictError("A category with that name or slug already exists")

    async def _move(self, category: Category, parent_id: int | None) -> None:
        if parent_id == category.id:
            raise ValidationError("A category can't be its own parent")
        usage = (await self._usage(category.id)).get(category.id, Usage())
        if parent_id is not None:
            await self._parent(parent_id)
            if usage.children:
                raise ValidationError("A category with subcategories can't become a subcategory")
        if usage.artists or usage.services or usage.templates:
            raise ConflictError("Category is in use; it can't be moved")
        category.parent_id = parent_id

    async def list(self) -> list[AdminCategoryOut]:
        rows = (await self.session.scalars(
            select(Category).order_by(Category.parent_id.nulls_first(), Category.sort_order, Category.id)
        )).all()
        usage = await self._usage()
        return [self._out(c, usage) for c in rows]

    async def create(self, body: CategoryIn) -> AdminCategoryOut:
        name = body.name.strip()
        parent = await self._parent(body.parent_id) if body.parent_id is not None else None
        slug = body.slug or slugify(f"{parent.name} {name}" if parent else name)
        if not slug:
            raise ValidationError("Name needs at least one letter or digit")
        await self._ensure_unique(slug, name, body.parent_id)
        sort_order = body.sort_order
        if sort_order is None:
            sort_order = await self.session.scalar(
                select(func.coalesce(func.max(Category.sort_order) + 1, 0)).where(siblings(body.parent_id))
            )
        category = Category(name=name, slug=slug, sort_order=sort_order, status=body.status, parent_id=body.parent_id)
        self.session.add(category)
        await self.session.flush()
        return self._out(category, {})

    async def update(self, category_id: int, body: CategoryPatch) -> AdminCategoryOut:
        category = await self._get(category_id)
        data = body.model_dump(exclude_unset=True)
        moving = "parent_id" in data and data["parent_id"] != category.parent_id
        if moving:
            await self._move(category, data["parent_id"])
        changes = {k: v for k, v in data.items() if v is not None and k != "parent_id"}
        if "name" in changes:
            changes["name"] = changes["name"].strip()
        if moving or "name" in changes or "slug" in changes:
            await self._ensure_unique(
                changes.get("slug", category.slug), changes.get("name", category.name), category.parent_id, category.id
            )
        if changes.get("status") == CategoryStatus.draft and category.status != CategoryStatus.draft:
            usage = (await self._usage(category.id)).get(category.id, Usage())
            if usage.artists or usage.services:
                raise ConflictError("Category is in use; it can't go back to draft")
        for field, value in changes.items():
            setattr(category, field, value)
        await self.session.flush()
        return self._out(category, await self._usage(category.id))

    async def delete(self, category_id: int) -> None:
        category = await self._get(category_id)
        if any((await self._usage(category.id)).get(category.id, Usage())):
            raise ConflictError("Category is in use; deactivate it instead")
        await self.session.delete(category)
        await self.session.flush()
