from fastapi import APIRouter, Depends

from app.controllers.catalog import catalog as controller
from app.controllers.catalog.dependencies import get_category_service
from app.schemas.catalog.catalog import CatalogCategoryOut
from app.services.catalog.catalog import CategoryService

router = APIRouter(tags=["catalog"])


@router.get("/categories", response_model=list[CatalogCategoryOut])
async def list_categories(service: CategoryService = Depends(get_category_service)) -> list[CatalogCategoryOut]:
    """Active categories → active subcategories → active services. Hiding a level hides everything under it."""
    return await controller.list_categories(service)


@router.get("/cities", response_model=list[str])
async def list_cities() -> list[str]:
    return controller.list_cities()
