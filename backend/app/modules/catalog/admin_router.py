"""Admin management of categories, subcategories and the service templates under them."""

from fastapi import APIRouter, Depends, Response

from app.core.auth import current_admin
from app.modules.catalog.presenters import category_out, template_out
from app.modules.catalog.schemas import (
    AdminCategoryOut,
    AdminTemplateOut,
    CategoryIn,
    CategoryPatch,
    TemplateIn,
    TemplatePatch,
)
from app.modules.catalog.service import CategoryService, get_category_service
from app.modules.catalog.template_service import (
    ServiceTemplateService,
    get_service_template_service,
)

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(current_admin)])


@router.get("/categories", response_model=list[AdminCategoryOut])
async def list_categories(service: CategoryService = Depends(get_category_service)) -> list[AdminCategoryOut]:
    return [category_out(row) for row in await service.list()]


@router.post("/categories", response_model=AdminCategoryOut, status_code=201)
async def create_category(body: CategoryIn, service: CategoryService = Depends(get_category_service)) -> AdminCategoryOut:
    return category_out(await service.create(body))


@router.patch("/categories/{category_id}", response_model=AdminCategoryOut)
async def update_category(
    category_id: int, body: CategoryPatch, service: CategoryService = Depends(get_category_service)
) -> AdminCategoryOut:
    return category_out(await service.update(category_id, body))


@router.delete("/categories/{category_id}", status_code=204)
async def delete_category(category_id: int, service: CategoryService = Depends(get_category_service)) -> Response:
    await service.delete(category_id)
    return Response(status_code=204)


@router.get("/service-templates", response_model=list[AdminTemplateOut])
async def list_templates(
    subcategory_id: int, service: ServiceTemplateService = Depends(get_service_template_service)
) -> list[AdminTemplateOut]:
    return [template_out(row) for row in await service.list(subcategory_id)]


@router.post("/service-templates", response_model=AdminTemplateOut, status_code=201)
async def create_template(
    body: TemplateIn, service: ServiceTemplateService = Depends(get_service_template_service)
) -> AdminTemplateOut:
    return template_out(await service.create(body))


@router.patch("/service-templates/{template_id}", response_model=AdminTemplateOut)
async def update_template(
    template_id: int, body: TemplatePatch, service: ServiceTemplateService = Depends(get_service_template_service)
) -> AdminTemplateOut:
    return template_out(await service.update(template_id, body))


@router.delete("/service-templates/{template_id}", status_code=204)
async def delete_template(
    template_id: int, service: ServiceTemplateService = Depends(get_service_template_service)
) -> Response:
    await service.delete(template_id)
    return Response(status_code=204)
