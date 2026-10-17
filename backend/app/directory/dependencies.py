import uuid

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.artist.models import ArtistProfile
from app.core.database import get_db
from app.core.exceptions import NotFoundError
from app.core.rate_limit import Limit, limit_by_ip
from app.directory import constants
from app.directory.repository import DirectoryRepository
from app.directory.service import DirectoryService
from app.shared.clock import Clock, get_clock
from app.upload.service import ImageStorage, get_storage


def get_directory_service(
    session: AsyncSession = Depends(get_db, scope="function"),
    storage: ImageStorage = Depends(get_storage),
    clock: Clock = Depends(get_clock),
) -> DirectoryService:
    return DirectoryService(session, storage, clock)


async def valid_artist_id(
    artist_id: uuid.UUID, session: AsyncSession = Depends(get_db, scope="function")
) -> ArtistProfile:
    """The approved artist behind `{artist_id}`, else 404: drafts, pending and rejected profiles aren't public."""
    profile = await DirectoryRepository(session).approved(artist_id)
    if profile is None:
        raise NotFoundError("Artist not found")
    return profile


def public_reads_per_ip() -> Limit:
    return constants.PUBLIC_READS_PER_IP


limit_public_reads = limit_by_ip("directory_read", public_reads_per_ip)
