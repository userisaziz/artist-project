from fastapi import APIRouter, Depends

from app.catalog.config import get_catalog_settings
from app.catalog.dependencies import get_category_service
from app.catalog.schemas import CatalogCategoryOut
from app.catalog.service import CategoryService
from app.catalog.utils import catalog_tree

router = APIRouter(tags=["catalog"])


@router.get("/categories", response_model=list[CatalogCategoryOut])
async def list_categories(service: CategoryService = Depends(get_category_service)) -> list[CatalogCategoryOut]:
    """Active categories → active subcategories → active services. Hiding a level hides everything under it."""
    return catalog_tree(await service.catalog())


@router.get("/cities", response_model=list[str])
async def list_cities() -> list[str]:
    return get_catalog_settings().cities
