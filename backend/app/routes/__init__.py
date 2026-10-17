"""`api_router` (/api/v1): every feature's routers. Each /artists/me… router comes before the directory,
otherwise "me" would be read as an artist id."""

from fastapi import APIRouter

from app.api.v1 import (
    admin_bookings,
    admin_reviews,
    artist_bookings,
    artist_reviews,
    bookings,
    directory,
)
from app.auth import router as auth
from app.routes.artist import admin as artist_admin
from app.routes.artist import artist
from app.routes.catalog import admin as catalog_admin
from app.routes.catalog import catalog
from app.routes.upload import upload
from app.routes.user import user

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router)
api_router.include_router(user.router)
api_router.include_router(catalog.router)
api_router.include_router(upload.router)
api_router.include_router(artist.router)
api_router.include_router(artist_bookings.router)
api_router.include_router(artist_reviews.router)
api_router.include_router(directory.router)  # after every /artists/me router: "me" isn't an artist id
api_router.include_router(bookings.router)
api_router.include_router(artist_admin.router)
api_router.include_router(admin_bookings.router)
api_router.include_router(admin_reviews.router)
api_router.include_router(catalog_admin.router)
