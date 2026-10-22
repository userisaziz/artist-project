from fastapi import APIRouter, Depends, Query

from app.catalog.config import get_catalog_settings
from app.catalog.dependencies import get_area_service, get_category_service, limit_public_reads
from app.catalog.schemas import AreaOut, CatalogCategoryOut
from app.catalog.service import AreaService, CategoryService
from app.catalog.utils import catalog_tree
from app.shared.responses import errors

router = APIRouter(tags=["catalog"], responses=errors(422, 429), dependencies=[Depends(limit_public_reads)])


@router.get(
    "/categories",
    response_model=list[CatalogCategoryOut],
    status_code=200,
    summary="Active categories and their service templates",
)
async def list_categories(service: CategoryService = Depends(get_category_service)) -> list[dict]:
    """Active categories → active subcategories → active services. Hiding a level hides everything under it."""
    return catalog_tree(await service.catalog())


@router.get("/cities", response_model=list[str], summary="Cities artists can work in", status_code=200)
async def list_cities() -> list[str]:
    return get_catalog_settings().cities


@router.get("/areas", response_model=list[AreaOut], summary="A city's areas, by name", status_code=200)
async def list_areas(
    city: str = Query(..., min_length=1, max_length=60),
    areas: AreaService = Depends(get_area_service),
) -> list:
    """What an artist picks their studio's area from, e.g. "BTM Layout" in Bangalore. Unknown cities have none."""
    return list(await areas.in_city(city))


@router.get(
    "/areas/nearest",
    response_model=AreaOut | None,
    summary="The area a map pin is in",
    status_code=200,
)
async def nearest_area(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    areas: AreaService = Depends(get_area_service),
):
    """The area whose centre is closest to the pin, or null when the pin is outside every known area."""
    return await areas.nearest(lat, lng)
