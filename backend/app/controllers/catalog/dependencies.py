from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.services.catalog.catalog import CategoryService
from app.services.catalog.template import ServiceTemplateService


def get_category_service(session: AsyncSession = Depends(get_db)) -> CategoryService:
    return CategoryService(session)


def get_service_template_service(session: AsyncSession = Depends(get_db)) -> ServiceTemplateService:
    return ServiceTemplateService(session)
