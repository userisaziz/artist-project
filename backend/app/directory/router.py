import uuid
from datetime import date

from fastapi import APIRouter, Depends, Query

from app.artist.models import ArtistProfile
from app.directory.dependencies import get_directory_service, valid_artist_id
from app.directory.schemas import ArtistCardPage, ArtistPublic, AvailabilityOut
from app.directory.service import DirectoryService
from app.review.dependencies import get_review_service
from app.review.schemas import ReviewPage
from app.review.service import ReviewService
from app.shared.responses import errors

# Public: no sign-in needed to browse artists. Registered after the /artists/me routers so "me" never reads as an id.
router = APIRouter(prefix="/artists", tags=["directory"], responses=errors(404, 422))


@router.get("", response_model=ArtistCardPage, status_code=200, summary="Browse approved artists")
async def list_artists(
    city: str | None = Query(None, max_length=60),
    category_id: int | None = None,
    q: str | None = Query(None, max_length=100),
    limit: int = Query(20, ge=1, le=50),
    cursor: str | None = None,
    directory: DirectoryService = Depends(get_directory_service),
) -> dict:
    items, next_cursor = await directory.list(city, category_id, q, limit, cursor)
    return {"items": items, "next_cursor": next_cursor}


@router.get("/{artist_id}", response_model=ArtistPublic, summary="An approved artist's public profile", status_code=200)
async def get_artist(
    artist: ArtistProfile = Depends(valid_artist_id), directory: DirectoryService = Depends(get_directory_service)
) -> dict:
    return await directory.get(artist)


@router.get(
    "/{artist_id}/availability", response_model=AvailabilityOut, summary="Bookable slots for one day", status_code=200
)
async def get_availability(
    service_id: uuid.UUID,
    artist: ArtistProfile = Depends(valid_artist_id),
    date: date = Query(..., description="An IST calendar date, YYYY-MM-DD"),
    directory: DirectoryService = Depends(get_directory_service),
) -> dict:
    return await directory.availability(artist, date, service_id)


@router.get(
    "/{artist_id}/reviews",
    response_model=ReviewPage,
    summary="An artist's public reviews and rating summary",
    status_code=200,
)
async def list_artist_reviews(
    artist: ArtistProfile = Depends(valid_artist_id),
    limit: int = Query(10, ge=1, le=50),
    cursor: str | None = None,
    reviews: ReviewService = Depends(get_review_service),
) -> dict:
    items, next_cursor, summary = await reviews.public_list(artist.id, limit, cursor)
    return {"items": items, "next_cursor": next_cursor, "summary": summary}
