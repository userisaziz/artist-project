from app.controllers.catalog.presenters import catalog_tree
from app.core.config import get_settings
from app.schemas.catalog.catalog import CatalogCategoryOut
from app.services.catalog.catalog import CategoryService


async def list_categories(service: CategoryService) -> list[CatalogCategoryOut]:
    return catalog_tree(await service.catalog())


def list_cities() -> list[str]:
    return get_settings().cities
