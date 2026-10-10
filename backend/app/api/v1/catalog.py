from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_db
from app.models.category import Category
from app.schemas.artist import CategoryOut

router = APIRouter(tags=["catalog"])


@router.get("/categories", response_model=list[CategoryOut])
async def list_categories(session: AsyncSession = Depends(get_db)) -> list[CategoryOut]:
    rows = await session.scalars(select(Category).where(Category.is_active.is_(True)).order_by(Category.sort_order))
    return [CategoryOut.model_validate(c) for c in rows]


@router.get("/cities", response_model=list[str])
async def list_cities() -> list[str]:
    return get_settings().cities
