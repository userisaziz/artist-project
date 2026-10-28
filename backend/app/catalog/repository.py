"""Queries over categories and service templates, including how often each is in use."""

from collections.abc import Iterable, Sequence
from typing import NamedTuple

from sqlalchemy import ColumnElement, case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.artist.models import ArtistServiceItem, artist_categories
from app.catalog.models import Area, Category, ServiceTemplate
from app.shared.enums import CategoryStatus
from app.shared.geo import distance_km
from app.shared.search import like_pattern


class Usage(NamedTuple):
    artists: int = 0
    services: int = 0
    children: int = 0
    templates: int = 0


def siblings(parent_id: int | None) -> ColumnElement[bool]:
    return Category.parent_id.is_(None) if parent_id is None else Category.parent_id == parent_id


class CategoryRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get(self, category_id: int) -> Category | None:
        return await self.session.get(Category, category_id)

    async def all_ordered(self) -> Sequence[Category]:
        """Top-level categories first, then by sort order."""
        return (
            await self.session.scalars(
                select(Category).order_by(Category.parent_id.nulls_first(), Category.sort_order, Category.id)
            )
        ).all()

    async def active_ordered(self) -> Sequence[Category]:
        return (
            await self.session.scalars(
                select(Category)
                .where(Category.status == CategoryStatus.active)
                .order_by(Category.sort_order, Category.id)
            )
        ).all()

    async def top_level_by_ids(self, ids: Iterable[int]) -> Sequence[Category]:
        return (
            await self.session.scalars(select(Category).where(Category.id.in_(ids), Category.parent_id.is_(None)))
        ).all()

    async def by_ids(self, ids: Iterable[int]) -> list[Category]:
        return list((await self.session.execute(select(Category).where(Category.id.in_(ids)))).scalars())

    async def usage(self, category_id: int | None = None) -> dict[int, Usage]:
        """category id → how many artists, artist services, subcategories and templates point at it."""
        queries = (
            select(artist_categories.c.category_id, func.count()).group_by(artist_categories.c.category_id),
            select(ArtistServiceItem.category_id, func.count()).group_by(ArtistServiceItem.category_id),
            select(Category.parent_id, func.count())
            .where(Category.parent_id.is_not(None))
            .group_by(Category.parent_id),
            select(ServiceTemplate.subcategory_id, func.count()).group_by(ServiceTemplate.subcategory_id),
        )
        counts: list[dict[int, int]] = []
        for query in queries:
            if category_id is not None:
                query = query.where(query.selected_columns[0] == category_id)
            counts.append({key: n for key, n in (await self.session.execute(query)).all() if key is not None})
        return {cid: Usage(*(c.get(cid, 0) for c in counts)) for cid in set().union(*counts)}

    async def name_or_slug_taken(self, slug: str, name: str, parent_id: int | None, exclude_id: int | None) -> bool:
        """Slugs are unique everywhere; names only among siblings (two parents can each have "Bridal")."""
        query = select(Category.id).where(
            (Category.slug == slug) | ((func.lower(Category.name) == name.lower()) & siblings(parent_id))
        )
        if exclude_id is not None:
            query = query.where(Category.id != exclude_id)
        return bool(await self.session.scalar(query.limit(1)))

    async def next_sort_order(self, parent_id: int | None) -> int:
        return (
            await self.session.execute(
                select(func.coalesce(func.max(Category.sort_order) + 1, 0)).where(siblings(parent_id))
            )
        ).scalar_one()

    def add(self, category: Category) -> None:
        self.session.add(category)

    async def delete(self, category: Category) -> None:
        await self.session.delete(category)


class TemplateRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get(self, template_id: int) -> ServiceTemplate | None:
        return await self.session.get(ServiceTemplate, template_id)

    async def for_subcategory(self, subcategory_id: int) -> Sequence[ServiceTemplate]:
        return (
            await self.session.scalars(
                select(ServiceTemplate)
                .where(ServiceTemplate.subcategory_id == subcategory_id)
                .order_by(ServiceTemplate.sort_order, ServiceTemplate.id)
            )
        ).all()

    async def active_ordered(self) -> Sequence[ServiceTemplate]:
        return (
            await self.session.scalars(
                select(ServiceTemplate)
                .where(ServiceTemplate.is_active.is_(True))
                .order_by(ServiceTemplate.sort_order, ServiceTemplate.id)
            )
        ).all()

    async def artist_counts(self, template_id: int | None = None) -> dict[int, int]:
        """template id → how many artists offer it."""
        query = (
            select(ArtistServiceItem.template_id, func.count(func.distinct(ArtistServiceItem.artist_id)))
            .where(ArtistServiceItem.template_id.is_not(None))
            .group_by(ArtistServiceItem.template_id)
        )
        if template_id is not None:
            query = query.where(ArtistServiceItem.template_id == template_id)
        return {key: n for key, n in (await self.session.execute(query)).all() if key is not None}

    async def name_taken(self, subcategory_id: int, name: str, exclude_id: int | None) -> bool:
        query = select(ServiceTemplate.id).where(
            ServiceTemplate.subcategory_id == subcategory_id, func.lower(ServiceTemplate.name) == name.lower()
        )
        if exclude_id is not None:
            query = query.where(ServiceTemplate.id != exclude_id)
        return bool(await self.session.scalar(query.limit(1)))

    async def next_sort_order(self, subcategory_id: int) -> int:
        return (
            await self.session.execute(
                select(func.coalesce(func.max(ServiceTemplate.sort_order) + 1, 0)).where(
                    ServiceTemplate.subcategory_id == subcategory_id
                )
            )
        ).scalar_one()

    def add(self, template: ServiceTemplate) -> None:
        self.session.add(template)

    async def delete(self, template: ServiceTemplate) -> None:
        await self.session.delete(template)


class AreaRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def in_city(self, city: str) -> Sequence[Area]:
        query = select(Area).where(Area.city == city, Area.is_active).order_by(Area.name)
        return (await self.session.scalars(query)).all()

    async def named_like(self, q: str, limit: int) -> Sequence[Area]:
        """Active areas whose name contains `q` (any case): names starting with it first, then by name."""
        pattern = like_pattern(q)
        starts = case((Area.name.ilike(pattern[1:], escape="\\"), 0), else_=1)
        query = (
            select(Area)
            .where(Area.is_active, Area.name.ilike(pattern, escape="\\"))
            .order_by(starts, Area.name, Area.city)
            .limit(limit)
        )
        return (await self.session.scalars(query)).all()

    async def nearest(self, lat: float, lng: float, max_km: float) -> Area | None:
        """The active area whose centre is closest to (lat, lng), if any is within `max_km`."""
        km = distance_km(Area.latitude, Area.longitude, lat, lng)
        query = select(Area).where(Area.is_active, km <= max_km).order_by(km).limit(1)
        return await self.session.scalar(query)
