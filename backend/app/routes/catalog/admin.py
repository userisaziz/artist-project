"""Admin management of categories, subcategories and the service templates under them."""

from fastapi import APIRouter, Depends, Response

from app.controllers.catalog import admin as controller
from app.controllers.catalog.dependencies import (
    get_category_service,
    get_service_template_service,
)
from app.core.auth import current_admin
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

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(current_admin)])


@router.get("/categories", response_model=list[AdminCategoryOut])
async def list_categories(service: CategoryService = Depends(get_category_service)) -> list[AdminCategoryOut]:
    return await controller.list_categories(service)


@router.post("/categories", response_model=AdminCategoryOut, status_code=201)
async def create_category(body: CategoryIn, service: CategoryService = Depends(get_category_service)) -> AdminCategoryOut:
    return await controller.create_category(body, service)


@router.patch("/categories/{category_id}", response_model=AdminCategoryOut)
async def update_category(
    category_id: int, body: CategoryPatch, service: CategoryService = Depends(get_category_service)
) -> AdminCategoryOut:
    return await controller.update_category(category_id, body, service)


@router.delete("/categories/{category_id}", status_code=204)
async def delete_category(category_id: int, service: CategoryService = Depends(get_category_service)) -> Response:
    return await controller.delete_category(category_id, service)


@router.get("/service-templates", response_model=list[AdminTemplateOut])
async def list_templates(
    subcategory_id: int, service: ServiceTemplateService = Depends(get_service_template_service)
) -> list[AdminTemplateOut]:
    return await controller.list_templates(subcategory_id, service)


@router.post("/service-templates", response_model=AdminTemplateOut, status_code=201)
async def create_template(
    body: TemplateIn, service: ServiceTemplateService = Depends(get_service_template_service)
) -> AdminTemplateOut:
    return await controller.create_template(body, service)


@router.patch("/service-templates/{template_id}", response_model=AdminTemplateOut)
async def update_template(
    template_id: int, body: TemplatePatch, service: ServiceTemplateService = Depends(get_service_template_service)
) -> AdminTemplateOut:
    return await controller.update_template(template_id, body, service)


@router.delete("/service-templates/{template_id}", status_code=204)
async def delete_template(
    template_id: int, service: ServiceTemplateService = Depends(get_service_template_service)
) -> Response:
    return await controller.delete_template(template_id, service)
