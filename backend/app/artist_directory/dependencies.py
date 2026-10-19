from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.artist_directory.service import ArtistDirectoryService
from app.core.database import get_db
from app.shared.clock import Clock, get_clock
from app.upload.service import ImageStorage, get_storage


def get_artist_directory_service(
    session: AsyncSession = Depends(get_db, scope="function"),
    storage: ImageStorage = Depends(get_storage),
    clock: Clock = Depends(get_clock),
) -> ArtistDirectoryService:
    return ArtistDirectoryService(session, storage, clock)
