from fastapi import APIRouter, Depends

from app.core.config import get_settings
from app.modules.catalog.presenters import catalog_tree
from app.modules.catalog.schemas import CatalogCategoryOut
from app.modules.catalog.service import CategoryService, get_category_service

router = APIRouter(tags=["catalog"])


@router.get("/categories", response_model=list[CatalogCategoryOut])
async def list_categories(service: CategoryService = Depends(get_category_service)) -> list[CatalogCategoryOut]:
    """Active categories → active subcategories → active services. Hiding a level hides everything under it."""
    return catalog_tree(await service.catalog())


@router.get("/cities", response_model=list[str])
async def list_cities() -> list[str]:
    return get_settings().cities
