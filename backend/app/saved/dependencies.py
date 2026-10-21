from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.rate_limit import Limit, limit_by_user
from app.saved import constants
from app.saved.service import SavedService
from app.shared.clock import Clock, get_clock
from app.upload.service import ImageStorage, get_storage


def get_saved_service(
    session: AsyncSession = Depends(get_db, scope="function"),
    storage: ImageStorage = Depends(get_storage),
    clock: Clock = Depends(get_clock),
) -> SavedService:
    return SavedService(session, storage, clock)


def saves_per_user() -> Limit:
    return constants.SAVES_PER_USER


limit_saves = limit_by_user("saved_item", saves_per_user)
