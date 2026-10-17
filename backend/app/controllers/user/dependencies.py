from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.services.user.user import UserService


def get_user_service(session: AsyncSession = Depends(get_db)) -> UserService:
    return UserService(session)
