import uuid

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.artist.models import ArtistProfile
from app.core.database import get_db
from app.core.exceptions import NotFoundError
from app.directory.repository import DirectoryRepository
from app.directory.service import DirectoryService
from app.shared.clock import Clock, get_clock
from app.upload.service import ImageStorage, get_storage


def get_directory_service(
    session: AsyncSession = Depends(get_db),
    storage: ImageStorage = Depends(get_storage),
    clock: Clock = Depends(get_clock),
) -> DirectoryService:
    return DirectoryService(session, storage, clock)


async def valid_artist_id(artist_id: uuid.UUID, session: AsyncSession = Depends(get_db)) -> ArtistProfile:
    """The approved artist behind `{artist_id}`, else 404: drafts, pending and rejected profiles aren't public."""
    profile = await DirectoryRepository(session).approved(artist_id)
    if profile is None:
        raise NotFoundError("Artist not found")
    return profile
