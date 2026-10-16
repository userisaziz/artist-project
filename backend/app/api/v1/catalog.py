from collections import defaultdict

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_db
from app.models.category import Category
from app.models.service_template import ServiceTemplate
from app.schemas.artist import CatalogCategoryOut, SubcategoryOut, TemplateOut
from app.utils.enums import CategoryStatus

router = APIRouter(tags=["catalog"])


@router.get("/categories", response_model=list[CatalogCategoryOut])
async def list_categories(session: AsyncSession = Depends(get_db)) -> list[CatalogCategoryOut]:
    """Active categories → active subcategories → active services. Hiding a level hides everything under it."""
    categories = (await session.scalars(
        select(Category).where(Category.status == CategoryStatus.active).order_by(Category.sort_order, Category.id)
    )).all()
    templates = (await session.scalars(
        select(ServiceTemplate).where(ServiceTemplate.is_active.is_(True)).order_by(ServiceTemplate.sort_order, ServiceTemplate.id)
    )).all()
    services: dict[int, list[TemplateOut]] = defaultdict(list)
    for template in templates:
        services[template.subcategory_id].append(TemplateOut.model_validate(template))
    subcategories: dict[int, list[SubcategoryOut]] = defaultdict(list)
    for c in categories:
        if c.parent_id is not None:
            subcategories[c.parent_id].append(SubcategoryOut(id=c.id, slug=c.slug, name=c.name, services=services[c.id]))
    return [
        CatalogCategoryOut(id=c.id, slug=c.slug, name=c.name, subcategories=subcategories[c.id])
        for c in categories if c.parent_id is None
    ]


@router.get("/cities", response_model=list[str])
async def list_cities() -> list[str]:
    return get_settings().cities
