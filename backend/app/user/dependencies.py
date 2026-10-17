from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.user.service import UserService


def get_user_service(session: AsyncSession = Depends(get_db, scope="function")) -> UserService:
    return UserService(session)
