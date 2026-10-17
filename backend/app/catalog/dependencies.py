from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.catalog.models import Category, ServiceTemplate
from app.catalog.repository import CategoryRepository, TemplateRepository
from app.catalog.service import CategoryService
from app.catalog.template import ServiceTemplateService
from app.core.database import get_db
from app.core.exceptions import NotFoundError


def get_category_service(session: AsyncSession = Depends(get_db)) -> CategoryService:
    return CategoryService(session)


def get_service_template_service(session: AsyncSession = Depends(get_db)) -> ServiceTemplateService:
    return ServiceTemplateService(session)


async def valid_category_id(category_id: int, session: AsyncSession = Depends(get_db)) -> Category:
    category = await CategoryRepository(session).get(category_id)
    if category is None:
        raise NotFoundError("Category not found")
    return category


async def valid_template_id(template_id: int, session: AsyncSession = Depends(get_db)) -> ServiceTemplate:
    template = await TemplateRepository(session).get(template_id)
    if template is None:
        raise NotFoundError("Service not found")
    return template
