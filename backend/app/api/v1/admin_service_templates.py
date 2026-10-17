from fastapi import APIRouter, Depends, Response

from app.core.auth import current_admin
from app.schemas.service_template import AdminTemplateOut, TemplateIn, TemplatePatch
from app.services.service_template_service import (
    ServiceTemplateService,
    get_service_template_service,
)

router = APIRouter(prefix="/admin/service-templates", tags=["admin"], dependencies=[Depends(current_admin)])


@router.get("", response_model=list[AdminTemplateOut])
async def list_templates(
    subcategory_id: int, service: ServiceTemplateService = Depends(get_service_template_service)
) -> list[AdminTemplateOut]:
    return await service.list(subcategory_id)


@router.post("", response_model=AdminTemplateOut, status_code=201)
async def create_template(
    body: TemplateIn, service: ServiceTemplateService = Depends(get_service_template_service)
) -> AdminTemplateOut:
    return await service.create(body)


@router.patch("/{template_id}", response_model=AdminTemplateOut)
async def update_template(
    template_id: int, body: TemplatePatch, service: ServiceTemplateService = Depends(get_service_template_service)
) -> AdminTemplateOut:
    return await service.update(template_id, body)


@router.delete("/{template_id}", status_code=204)
async def delete_template(
    template_id: int, service: ServiceTemplateService = Depends(get_service_template_service)
) -> Response:
    await service.delete(template_id)
    return Response(status_code=204)
