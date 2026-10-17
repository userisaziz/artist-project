"""Admin management of categories, subcategories and the service templates under them."""

from fastapi import APIRouter, Depends, Response

from app.catalog.dependencies import (
    get_category_service,
    get_service_template_service,
    valid_category_id,
    valid_template_id,
)
from app.catalog.models import Category, ServiceTemplate
from app.catalog.schemas import (
    AdminCategoryOut,
    AdminTemplateOut,
    CategoryIn,
    CategoryPatch,
    TemplateIn,
    TemplatePatch,
)
from app.catalog.service import CategoryService
from app.catalog.template import ServiceTemplateService
from app.catalog.utils import category_out, template_out
from app.core.auth import audited_admin
from app.shared.responses import errors

router = APIRouter(
    prefix="/admin", tags=["admin"], dependencies=[Depends(audited_admin)], responses=errors(401, 403, 404, 409, 422)
)


@router.get("/categories", response_model=list[AdminCategoryOut], status_code=200, summary="All categories with usage")
async def list_categories(service: CategoryService = Depends(get_category_service)) -> list[dict]:
    return [category_out(row) for row in await service.list()]


@router.post("/categories", response_model=AdminCategoryOut, status_code=201, summary="Create a category")
async def create_category(body: CategoryIn, service: CategoryService = Depends(get_category_service)) -> dict:
    return category_out(await service.create(body))


@router.patch(
    "/categories/{category_id}", response_model=AdminCategoryOut, summary="Edit or move a category", status_code=200
)
async def update_category(
    body: CategoryPatch,
    category: Category = Depends(valid_category_id),
    service: CategoryService = Depends(get_category_service),
) -> dict:
    return category_out(await service.update(category, body))


@router.delete("/categories/{category_id}", status_code=204, summary="Delete an unused category")
async def delete_category(
    category: Category = Depends(valid_category_id), service: CategoryService = Depends(get_category_service)
) -> Response:
    await service.delete(category)
    return Response(status_code=204)


@router.get(
    "/service-templates", response_model=list[AdminTemplateOut], summary="All service templates", status_code=200
)
async def list_templates(
    subcategory_id: int, service: ServiceTemplateService = Depends(get_service_template_service)
) -> list[dict]:
    return [template_out(row) for row in await service.list(subcategory_id)]


@router.post(
    "/service-templates", response_model=AdminTemplateOut, status_code=201, summary="Create a service template"
)
async def create_template(
    body: TemplateIn, service: ServiceTemplateService = Depends(get_service_template_service)
) -> dict:
    return template_out(await service.create(body))


@router.patch(
    "/service-templates/{template_id}",
    response_model=AdminTemplateOut,
    summary="Edit a service template",
    status_code=200,
)
async def update_template(
    body: TemplatePatch,
    template: ServiceTemplate = Depends(valid_template_id),
    service: ServiceTemplateService = Depends(get_service_template_service),
) -> dict:
    return template_out(await service.update(template, body))


@router.delete("/service-templates/{template_id}", status_code=204, summary="Delete an unused service template")
async def delete_template(
    template: ServiceTemplate = Depends(valid_template_id),
    service: ServiceTemplateService = Depends(get_service_template_service),
) -> Response:
    await service.delete(template)
    return Response(status_code=204)
