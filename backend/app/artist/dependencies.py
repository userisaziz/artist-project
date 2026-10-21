from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.artist.admin_service import AdminArtistService
from app.artist.custom_service_review import CustomServiceReview
from app.artist.schedule_service import ScheduleService
from app.artist.service import ArtistService
from app.core.database import get_db
from app.shared.clock import Clock, get_clock
from app.upload.service import ImageStorage, get_storage


def get_artist_service(
    session: AsyncSession = Depends(get_db, scope="function"),
    storage: ImageStorage = Depends(get_storage),
    clock: Clock = Depends(get_clock),
) -> ArtistService:
    return ArtistService(session, storage, clock)


def get_admin_artist_service(
    session: AsyncSession = Depends(get_db, scope="function"), clock: Clock = Depends(get_clock)
) -> AdminArtistService:
    return AdminArtistService(session, clock)


def get_custom_service_review(session: AsyncSession = Depends(get_db, scope="function")) -> CustomServiceReview:
    return CustomServiceReview(session)


def get_schedule_service(
    session: AsyncSession = Depends(get_db, scope="function"), clock: Clock = Depends(get_clock)
) -> ScheduleService:
    return ScheduleService(session, clock)
