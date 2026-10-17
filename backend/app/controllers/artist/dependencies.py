from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.services.artist.admin import AdminArtistService
from app.services.artist.artist import ArtistService
from app.services.artist.custom_service_review import CustomServiceReview
from app.services.upload.storage import ImageStorage, get_storage


def get_artist_service(
    session: AsyncSession = Depends(get_db), storage: ImageStorage = Depends(get_storage)
) -> ArtistService:
    return ArtistService(session, storage)


def get_admin_artist_service(session: AsyncSession = Depends(get_db)) -> AdminArtistService:
    return AdminArtistService(session)


def get_custom_service_review(session: AsyncSession = Depends(get_db)) -> CustomServiceReview:
    return CustomServiceReview(session)
