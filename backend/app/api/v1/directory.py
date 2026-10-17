import uuid
from datetime import date

from fastapi import APIRouter, Depends, Query

from app.schemas.directory import ArtistCardPage, ArtistPublic, AvailabilityOut
from app.schemas.review import ReviewPage
from app.services.directory_service import DirectoryService, get_directory_service
from app.services.review_service import ReviewService, get_review_service

# Public: no sign-in needed to browse artists. Registered after the /artists/me routers so "me" never reads as an id.
router = APIRouter(prefix="/artists", tags=["directory"])


@router.get("", response_model=ArtistCardPage)
async def list_artists(
    city: str | None = Query(None, max_length=60),
    category_id: int | None = None,
    q: str | None = Query(None, max_length=100),
    limit: int = Query(20, ge=1, le=50),
    cursor: str | None = None,
    directory: DirectoryService = Depends(get_directory_service),
) -> ArtistCardPage:
    items, next_cursor = await directory.list(city, category_id, q, limit, cursor)
    return ArtistCardPage(items=items, next_cursor=next_cursor)


@router.get("/{artist_id}", response_model=ArtistPublic)
async def get_artist(artist_id: uuid.UUID, directory: DirectoryService = Depends(get_directory_service)) -> ArtistPublic:
    return await directory.get(artist_id)


@router.get("/{artist_id}/availability", response_model=AvailabilityOut)
async def get_availability(
    artist_id: uuid.UUID,
    service_id: uuid.UUID,
    date: date = Query(..., description="An IST calendar date, YYYY-MM-DD"),
    directory: DirectoryService = Depends(get_directory_service),
) -> AvailabilityOut:
    return await directory.availability(artist_id, date, service_id)


@router.get("/{artist_id}/reviews", response_model=ReviewPage)
async def list_artist_reviews(
    artist_id: uuid.UUID,
    limit: int = Query(10, ge=1, le=50),
    cursor: str | None = None,
    reviews: ReviewService = Depends(get_review_service),
) -> ReviewPage:
    items, next_cursor, summary = await reviews.public_list(artist_id, limit, cursor)
    return ReviewPage(items=items, next_cursor=next_cursor, summary=summary)
