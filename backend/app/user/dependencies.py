from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.shared.clock import Clock, get_clock
from app.upload.service import ImageStorage, get_storage
from app.user.service import UserService


def get_user_service(
    session: AsyncSession = Depends(get_db, scope="function"),
    storage: ImageStorage = Depends(get_storage),
    clock: Clock = Depends(get_clock),
) -> UserService:
    return UserService(session, storage, clock)
