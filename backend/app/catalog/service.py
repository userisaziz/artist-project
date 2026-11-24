"""Admin category management, two levels deep: top-level categories and their subcategories.
Categories in use are made inactive rather than deleted, so existing artists, services and
templates keep a valid reference. Also the public catalog tree."""

import re
from collections.abc import Sequence
from typing import NamedTuple

from sqlalchemy.ext.asyncio import AsyncSession

from app.catalog.constants import AREA_SEARCH_LIMIT, NEAREST_AREA_MAX_KM
from app.catalog.fields import FieldDef, check_schema, parse_schema
from app.catalog.models import Area, Category, ServiceTemplate
from app.catalog.repository import (
    AreaRepository,
    CategoryRepository,
    TemplateRepository,
    Usage,
)
from app.catalog.schemas import CategoryIn, CategoryPatch
from app.core.exceptions import ConflictError, ValidationError
from app.geocoder import service as geocoder_service
from app.shared.enums import CategoryStatus


def slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


class CategoryUsage(NamedTuple):
    category: Category
    usage: Usage


class Catalog(NamedTuple):
    """Active categories and active templates, each in display order."""

    categories: Sequence[Category]
    templates: Sequence[ServiceTemplate]


class CategoryService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.categories = CategoryRepository(session)
        self.templates = TemplateRepository(session)

    async def catalog(self) -> Catalog:
        return Catalog(await self.categories.active_ordered(), await self.templates.active_ordered())

    async def _usage_of(self, category: Category) -> Usage:
        return (await self.categories.usage(category.id)).get(category.id, Usage())

    async def _parent(self, parent_id: int) -> Category:
        parent = await self.categories.get(parent_id)
        if parent is None or parent.parent_id is not None:
            raise ValidationError("Subcategories can only sit under a top-level category")
        return parent

    async def _ensure_unique(self, slug: str, name: str, parent_id: int | None, exclude_id: int | None = None) -> None:
        if await self.categories.name_or_slug_taken(slug, name, parent_id, exclude_id):
            raise ConflictError("A category with that name or slug already exists")

    async def _move(self, category: Category, parent_id: int | None) -> None:
        if parent_id == category.id:
            raise ValidationError("A category can't be its own parent")
        usage = await self._usage_of(category)
        if parent_id is not None:
            await self._parent(parent_id)
            if usage.children:
                raise ValidationError("A category with subcategories can't become a subcategory")
        if usage.artists or usage.services or usage.templates:
            raise ConflictError("Category is in use; it can't be moved")
        category.parent_id = parent_id

    async def list(self) -> list[CategoryUsage]:
        rows = await self.categories.all_ordered()
        usage = await self.categories.usage()
        return [CategoryUsage(c, usage.get(c.id, Usage())) for c in rows]

    async def create(self, body: CategoryIn) -> CategoryUsage:
        name = body.name.strip()
        parent = await self._parent(body.parent_id) if body.parent_id is not None else None
        slug = body.slug or slugify(f"{parent.name} {name}" if parent else name)
        if not slug:
            raise ValidationError("Name needs at least one letter or digit")
        await self._ensure_unique(slug, name, body.parent_id)
        sort_order = body.sort_order
        if sort_order is None:
            sort_order = await self.categories.next_sort_order(body.parent_id)
        await self._check_fields(body.field_schema, body.parent_id, None)
        category = Category(
            name=name,
            slug=slug,
            sort_order=sort_order,
            status=body.status,
            parent_id=body.parent_id,
            fulfilment=body.fulfilment,
            default_unit=body.default_unit,
            field_schema=[f.model_dump(mode="json") for f in body.field_schema],
        )
        self.categories.add(category)
        await self.session.flush()
        return CategoryUsage(category, Usage())

    async def update(self, category: Category, body: CategoryPatch) -> CategoryUsage:
        data = body.model_dump(exclude_unset=True)
        moving = "parent_id" in data and data["parent_id"] != category.parent_id
        if moving:
            await self._move(category, data["parent_id"])
        if "fulfilment" in data:  # an explicit null is meaningful: follow the parent again
            category.fulfilment = data.pop("fulfilment")
        if "default_unit" in data:
            category.default_unit = data.pop("default_unit")
        if data.get("field_schema") is not None:
            schema = body.field_schema or []
            await self._check_fields(schema, category.parent_id, category)
            category.field_schema = [f.model_dump(mode="json") for f in schema]
        data.pop("field_schema", None)
        changes = {k: v for k, v in data.items() if v is not None and k != "parent_id"}
        if "name" in changes:
            changes["name"] = changes["name"].strip()
        if moving or "name" in changes or "slug" in changes:
            await self._ensure_unique(
                changes.get("slug", category.slug), changes.get("name", category.name), category.parent_id, category.id
            )
        if changes.get("status") == CategoryStatus.draft and category.status != CategoryStatus.draft:
            usage = await self._usage_of(category)
            if usage.artists or usage.services:
                raise ConflictError("Category is in use; it can't go back to draft")
        for field, value in changes.items():
            setattr(category, field, value)
        await self.session.flush()
        return CategoryUsage(category, await self._usage_of(category))

    async def _check_fields(self, schema: list[FieldDef], parent_id: int | None, category: Category | None) -> None:
        """Keys unique within the row and against its parent's; a category's keys also can't clash with its
        subcategories' own (they are merged when a service is filed under one)."""
        parent = await self.session.get(Category, parent_id) if parent_id is not None else None
        check_schema(schema, parse_schema(parent.field_schema) if parent else [])
        if category is not None and category.parent_id is None:
            for child in await self.categories.children(category.id):
                check_schema(parse_schema(child.field_schema), schema)

    async def delete(self, category: Category) -> None:
        if any(await self._usage_of(category)):
            raise ConflictError("Category is in use; deactivate it instead")
        await self.categories.delete(category)
        await self.session.flush()


class AreaService:
    """The areas of each city, which one a dropped pin is in, and what a typed place name points at."""

    def __init__(self, session: AsyncSession, geocoder: geocoder_service.Geocoder | None = None):
        self.areas = AreaRepository(session)
        self.geocoder = geocoder or geocoder_service.NoGeocoder()

    async def in_city(self, city: str) -> Sequence[Area]:
        return await self.areas.in_city(city)

    async def nearest(self, lat: float, lng: float) -> Area | None:
        return await self.areas.nearest(lat, lng, NEAREST_AREA_MAX_KM)

    async def search(self, q: str, near: tuple[float, float] | None = None) -> list[dict]:
        """Catalog areas named like `q` when there are any (the geocoder isn't asked); otherwise the geocoder's
        places, each snapped to the nearest area within NEAREST_AREA_MAX_KM."""
        areas = await self.areas.named_like(q, AREA_SEARCH_LIMIT)
        if areas:
            return [
                {
                    "label": f"{a.name}, {a.city}",
                    "name": a.name,
                    "city": a.city,
                    "latitude": a.latitude,
                    "longitude": a.longitude,
                    "area_id": a.id,
                    "source": "area",
                }
                for a in areas
            ]
        results = []
        for place in (await self.geocoder.search(q, near))[:AREA_SEARCH_LIMIT]:
            area = await self.areas.nearest(place.lat, place.lon, NEAREST_AREA_MAX_KM)
            results.append(
                {
                    "label": place.label,
                    "name": place.name,
                    "city": place.city,
                    "latitude": place.lat,
                    "longitude": place.lon,
                    "area_id": area.id if area else None,
                    "source": "geocoder",
                }
            )
        return results
