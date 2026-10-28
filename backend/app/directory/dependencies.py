import uuid
from datetime import date

from fastapi import Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.artist.models import ArtistProfile
from app.core.database import get_db
from app.core.exceptions import NotFoundError, ValidationError
from app.core.rate_limit import Limit, limit_by_ip
from app.directory import constants
from app.directory.constants import DirectorySort
from app.directory.repository import DirectoryRepository
from app.directory.service import DirectoryService
from app.directory.utils import SearchFilters
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


def search_filters(
    city: str | None = Query(None, max_length=60),
    category_id: int | None = None,
    q: str | None = Query(None, max_length=100),
    min_rating: float | None = Query(None, ge=0, le=5, description="Only artists rated at least this (one decimal)"),
    max_price_paise: int | None = Query(None, ge=0, description="Only artists whose cheapest service costs at most"),
    home_visit: bool = Query(False, description="Only artists who travel to the client"),
    available_on: date | None = Query(None, description="Only artists with an open slot this IST day"),
    near_lat: float | None = Query(None, ge=-90, le=90),
    near_lng: float | None = Query(None, ge=-180, le=180),
    radius_km: float | None = Query(
        None,
        gt=0,
        le=constants.MAX_RADIUS_KM,
        description="With near_lat/near_lng: only artists this close. Omitted: widens 5, 10, 20 km, then no limit",
    ),
    sort: DirectorySort = DirectorySort.recent,
) -> SearchFilters:
    if (near_lat is None) != (near_lng is None):
        raise ValidationError("Send near_lat and near_lng together")
    near = (near_lat, near_lng) if near_lat is not None and near_lng is not None else None
    if sort == DirectorySort.nearest and near is None:
        raise ValidationError("Sorting by distance needs near_lat and near_lng")
    return SearchFilters(
        city=city,
        category_id=category_id,
        q=q,
        min_rating=min_rating,
        max_price_paise=max_price_paise,
        home_visit=home_visit,
        available_on=available_on,
        near=near,
        radius_km=radius_km if near else None,
        sort=sort,
    )


def public_reads_per_ip() -> Limit:
    return constants.PUBLIC_READS_PER_IP


limit_public_reads = limit_by_ip("directory_read", public_reads_per_ip)
