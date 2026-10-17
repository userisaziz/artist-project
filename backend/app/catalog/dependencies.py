from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.catalog.service import CategoryService
from app.catalog.template import ServiceTemplateService
from app.core.database import get_db


def get_category_service(session: AsyncSession = Depends(get_db)) -> CategoryService:
    return CategoryService(session)


def get_service_template_service(session: AsyncSession = Depends(get_db)) -> ServiceTemplateService:
    return ServiceTemplateService(session)
