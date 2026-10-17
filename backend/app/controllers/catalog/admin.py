from fastapi import Response

from app.controllers.catalog.presenters import category_out, template_out
from app.schemas.catalog.catalog import (
    AdminCategoryOut,
    AdminTemplateOut,
    CategoryIn,
    CategoryPatch,
    TemplateIn,
    TemplatePatch,
)
from app.services.catalog.catalog import CategoryService
from app.services.catalog.template import ServiceTemplateService


async def list_categories(service: CategoryService) -> list[AdminCategoryOut]:
    return [category_out(row) for row in await service.list()]


async def create_category(body: CategoryIn, service: CategoryService) -> AdminCategoryOut:
    return category_out(await service.create(body))


async def update_category(category_id: int, body: CategoryPatch, service: CategoryService) -> AdminCategoryOut:
    return category_out(await service.update(category_id, body))


async def delete_category(category_id: int, service: CategoryService) -> Response:
    await service.delete(category_id)
    return Response(status_code=204)


async def list_templates(subcategory_id: int, service: ServiceTemplateService) -> list[AdminTemplateOut]:
    return [template_out(row) for row in await service.list(subcategory_id)]


async def create_template(body: TemplateIn, service: ServiceTemplateService) -> AdminTemplateOut:
    return template_out(await service.create(body))


async def update_template(template_id: int, body: TemplatePatch, service: ServiceTemplateService) -> AdminTemplateOut:
    return template_out(await service.update(template_id, body))


async def delete_template(template_id: int, service: ServiceTemplateService) -> Response:
    await service.delete(template_id)
    return Response(status_code=204)
