from fastapi import APIRouter, Depends, Response

from app.core.dependencies import current_admin, get_category_service
from app.schemas.category import AdminCategoryOut, CategoryIn, CategoryPatch
from app.services.category_service import CategoryService

router = APIRouter(prefix="/admin/categories", tags=["admin"], dependencies=[Depends(current_admin)])


@router.get("", response_model=list[AdminCategoryOut])
async def list_categories(service: CategoryService = Depends(get_category_service)) -> list[AdminCategoryOut]:
    return await service.list()


@router.post("", response_model=AdminCategoryOut, status_code=201)
async def create_category(body: CategoryIn, service: CategoryService = Depends(get_category_service)) -> AdminCategoryOut:
    return await service.create(body)


@router.patch("/{category_id}", response_model=AdminCategoryOut)
async def update_category(
    category_id: int, body: CategoryPatch, service: CategoryService = Depends(get_category_service)
) -> AdminCategoryOut:
    return await service.update(category_id, body)


@router.delete("/{category_id}", status_code=204)
async def delete_category(category_id: int, service: CategoryService = Depends(get_category_service)) -> Response:
    await service.delete(category_id)
    return Response(status_code=204)
