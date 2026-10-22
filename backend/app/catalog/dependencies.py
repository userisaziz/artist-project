from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.catalog import constants
from app.catalog.models import Category, ServiceTemplate
from app.catalog.repository import CategoryRepository, TemplateRepository
from app.catalog.service import AreaService, CategoryService
from app.catalog.template import ServiceTemplateService
from app.core.database import get_db
from app.core.exceptions import NotFoundError
from app.core.rate_limit import Limit, limit_by_ip


def get_category_service(session: AsyncSession = Depends(get_db, scope="function")) -> CategoryService:
    return CategoryService(session)


def get_area_service(session: AsyncSession = Depends(get_db, scope="function")) -> AreaService:
    return AreaService(session)


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
