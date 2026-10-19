import uuid

from fastapi import APIRouter, Depends, Query

from app.artist_directory.constants import DirectoryStatus
from app.artist_directory.dependencies import get_artist_directory_service
from app.artist_directory.schemas import DirectoryPage, DirectorySummary, SuspendIn, SuspensionOut
from app.artist_directory.service import ArtistDirectoryService
from app.core.auth import audited_admin
from app.shared.responses import errors
from app.user.models import User

# Registered before the artist review router: "directory" must not be read as an artist id.
router = APIRouter(
    prefix="/admin/artists",
    tags=["admin artist directory"],
    dependencies=[Depends(audited_admin)],
    responses=errors(401, 403, 404, 409, 422),
)


@router.get("/directory", response_model=DirectoryPage, status_code=200, summary="Every listed artist, newest first")
async def list_artists(
    status: DirectoryStatus = "all",
    q: str | None = Query(None, max_length=100, description="Business name contains"),
    city: str | None = Query(None, max_length=60),
    limit: int = Query(20, ge=1, le=100),
    cursor: str | None = None,
    artists: ArtistDirectoryService = Depends(get_artist_directory_service),
) -> dict:
    items, next_cursor = await artists.list(status, q, city, limit, cursor)
    return {"items": items, "next_cursor": next_cursor}


@router.get("/directory/summary", response_model=DirectorySummary, status_code=200, summary="Counts and KPIs")
async def directory_summary(artists: ArtistDirectoryService = Depends(get_artist_directory_service)) -> dict:
    return await artists.summary()


@router.post("/{artist_id}/suspend", response_model=SuspensionOut, status_code=200, summary="Suspend an artist")
async def suspend_artist(
    artist_id: uuid.UUID,
    body: SuspendIn,
    admin: User = Depends(audited_admin),
    artists: ArtistDirectoryService = Depends(get_artist_directory_service),
) -> dict:
    return await artists.suspend(admin, artist_id, body.reason)


@router.post("/{artist_id}/reinstate", response_model=SuspensionOut, status_code=200, summary="Reinstate an artist")
async def reinstate_artist(
    artist_id: uuid.UUID, artists: ArtistDirectoryService = Depends(get_artist_directory_service)
) -> dict:
    return await artists.reinstate(artist_id)
