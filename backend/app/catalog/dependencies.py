from fastapi import Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.catalog import constants
from app.catalog.models import Category, ServiceTemplate
from app.catalog.repository import CategoryRepository, TemplateRepository
from app.catalog.service import AreaService, CategoryService
from app.catalog.template import ServiceTemplateService
from app.core.database import get_db
from app.core.exceptions import NotFoundError, ValidationError
from app.core.rate_limit import Limit, limit_by_ip
from app.geocoder.dependencies import get_geocoder
from app.geocoder.service import Geocoder


def get_category_service(session: AsyncSession = Depends(get_db, scope="function")) -> CategoryService:
    return CategoryService(session)


def get_area_service(
    session: AsyncSession = Depends(get_db, scope="function"), geocoder: Geocoder = Depends(get_geocoder)
) -> AreaService:
    return AreaService(session, geocoder)


def search_point(
    lat: float | None = Query(None, ge=-90, le=90), lng: float | None = Query(None, ge=-180, le=180)
) -> tuple[float, float] | None:
    """The searcher's position, to rank nearby places first; lat and lng come together or not at all."""
    if (lat is None) != (lng is None):
        raise ValidationError("Send lat and lng together")
    return (lat, lng) if lat is not None and lng is not None else None


def get_service_template_service(session: AsyncSession = Depends(get_db, scope="function")) -> ServiceTemplateService:
    return ServiceTemplateService(session)


async def valid_category_id(category_id: int, session: AsyncSession = Depends(get_db, scope="function")) -> Category:
    category = await CategoryRepository(session).get(category_id)
    if category is None:
        raise NotFoundError("Category not found")
    return category


async def valid_template_id(
    template_id: int, session: AsyncSession = Depends(get_db, scope="function")
) -> ServiceTemplate:
    template = await TemplateRepository(session).get(template_id)
    if template is None:
        raise NotFoundError("Service not found")
    return template


def public_reads_per_ip() -> Limit:
    return constants.PUBLIC_READS_PER_IP


limit_public_reads = limit_by_ip("catalog_read", public_reads_per_ip)
