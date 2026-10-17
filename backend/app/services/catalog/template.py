"""The admin's service list under each subcategory. Templates artists offer are hidden
rather than deleted, so those artists keep a valid reference."""

from typing import NamedTuple

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.models.catalog.catalog import Category, ServiceTemplate
from app.repositories.catalog.catalog import CategoryRepository, TemplateRepository
from app.schemas.catalog.catalog import TemplateIn, TemplatePatch


class TemplateUsage(NamedTuple):
    template: ServiceTemplate
    artist_count: int


class ServiceTemplateService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.categories = CategoryRepository(session)
        self.templates = TemplateRepository(session)

    async def _get(self, template_id: int) -> ServiceTemplate:
        template = await self.templates.get(template_id)
        if template is None:
            raise NotFoundError("Service not found")
        return template

    async def _subcategory(self, subcategory_id: int) -> Category:
        subcategory = await self.categories.get(subcategory_id)
        if subcategory is None or subcategory.parent_id is None:
            raise ValidationError("Services sit under a subcategory")
        return subcategory

    async def _ensure_unique(self, subcategory_id: int, name: str, exclude_id: int | None = None) -> None:
        if await self.templates.name_taken(subcategory_id, name, exclude_id):
            raise ConflictError("That subcategory already has a service with that name")

    async def list(self, subcategory_id: int) -> list[TemplateUsage]:
        await self._subcategory(subcategory_id)
        rows = await self.templates.for_subcategory(subcategory_id)
        counts = await self.templates.artist_counts()
        return [TemplateUsage(t, counts.get(t.id, 0)) for t in rows]

    async def create(self, body: TemplateIn) -> TemplateUsage:
        await self._subcategory(body.subcategory_id)
        name = body.name.strip()
        if not name:
            raise ValidationError("Name is required")
        await self._ensure_unique(body.subcategory_id, name)
        sort_order = body.sort_order
        if sort_order is None:
            sort_order = await self.templates.next_sort_order(body.subcategory_id)
        template = ServiceTemplate(
            subcategory_id=body.subcategory_id, name=name, description=body.description,
            sort_order=sort_order, is_active=body.is_active,
        )
        self.templates.add(template)
        await self.session.flush()
        return TemplateUsage(template, 0)

    async def update(self, template_id: int, body: TemplatePatch) -> TemplateUsage:
        template = await self._get(template_id)
        changes = body.model_dump(exclude_unset=True)
        if changes.get("name") is not None:
            changes["name"] = changes["name"].strip()
            if not changes["name"]:
                raise ValidationError("Name is required")
            await self._ensure_unique(template.subcategory_id, changes["name"], template.id)
        for field, value in changes.items():
            if value is not None or field == "description":  # required columns: null means "leave as is"
                setattr(template, field, value)
        await self.session.flush()
        return TemplateUsage(template, (await self.templates.artist_counts(template.id)).get(template.id, 0))

    async def delete(self, template_id: int) -> None:
        template = await self._get(template_id)
        if (await self.templates.artist_counts(template.id)).get(template.id):
            raise ConflictError("Service is in use; hide it instead")
        await self.templates.delete(template)
        await self.session.flush()
