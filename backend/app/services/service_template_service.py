"""The admin's service list under each subcategory. Templates artists offer are hidden
rather than deleted, so those artists keep a valid reference."""

from fastapi import Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.models.artist import ArtistServiceItem
from app.models.category import Category
from app.models.service_template import ServiceTemplate
from app.schemas.service_template import AdminTemplateOut, TemplateIn, TemplatePatch


class ServiceTemplateService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def _artist_counts(self, template_id: int | None = None) -> dict[int, int]:
        query = (
            select(ArtistServiceItem.template_id, func.count(func.distinct(ArtistServiceItem.artist_id)))
            .where(ArtistServiceItem.template_id.is_not(None))
            .group_by(ArtistServiceItem.template_id)
        )
        if template_id is not None:
            query = query.where(ArtistServiceItem.template_id == template_id)
        return dict((await self.session.execute(query)).all())

    def _out(self, template: ServiceTemplate, counts: dict[int, int]) -> AdminTemplateOut:
        return AdminTemplateOut(
            id=template.id, subcategory_id=template.subcategory_id, name=template.name,
            description=template.description, sort_order=template.sort_order,
            is_active=template.is_active, artist_count=counts.get(template.id, 0),
        )

    async def _get(self, template_id: int) -> ServiceTemplate:
        template = await self.session.get(ServiceTemplate, template_id)
        if template is None:
            raise NotFoundError("Service not found")
        return template

    async def _subcategory(self, subcategory_id: int) -> Category:
        subcategory = await self.session.get(Category, subcategory_id)
        if subcategory is None or subcategory.parent_id is None:
            raise ValidationError("Services sit under a subcategory")
        return subcategory

    async def _ensure_unique(self, subcategory_id: int, name: str, exclude_id: int | None = None) -> None:
        query = select(ServiceTemplate.id).where(
            ServiceTemplate.subcategory_id == subcategory_id, func.lower(ServiceTemplate.name) == name.lower()
        )
        if exclude_id is not None:
            query = query.where(ServiceTemplate.id != exclude_id)
        if await self.session.scalar(query.limit(1)):
            raise ConflictError("That subcategory already has a service with that name")

    async def list(self, subcategory_id: int) -> list[AdminTemplateOut]:
        await self._subcategory(subcategory_id)
        rows = (await self.session.scalars(
            select(ServiceTemplate).where(ServiceTemplate.subcategory_id == subcategory_id)
            .order_by(ServiceTemplate.sort_order, ServiceTemplate.id)
        )).all()
        counts = await self._artist_counts()
        return [self._out(t, counts) for t in rows]

    async def create(self, body: TemplateIn) -> AdminTemplateOut:
        await self._subcategory(body.subcategory_id)
        name = body.name.strip()
        if not name:
            raise ValidationError("Name is required")
        await self._ensure_unique(body.subcategory_id, name)
        sort_order = body.sort_order
        if sort_order is None:
            sort_order = await self.session.scalar(
                select(func.coalesce(func.max(ServiceTemplate.sort_order) + 1, 0))
                .where(ServiceTemplate.subcategory_id == body.subcategory_id)
            )
        template = ServiceTemplate(
            subcategory_id=body.subcategory_id, name=name, description=body.description,
            sort_order=sort_order, is_active=body.is_active,
        )
        self.session.add(template)
        await self.session.flush()
        return self._out(template, {})

    async def update(self, template_id: int, body: TemplatePatch) -> AdminTemplateOut:
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
        return self._out(template, await self._artist_counts(template.id))

    async def delete(self, template_id: int) -> None:
        template = await self._get(template_id)
        if (await self._artist_counts(template.id)).get(template.id):
            raise ConflictError("Service is in use; hide it instead")
        await self.session.delete(template)
        await self.session.flush()


def get_service_template_service(session: AsyncSession = Depends(get_db)) -> ServiceTemplateService:
    return ServiceTemplateService(session)
