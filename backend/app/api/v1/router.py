from fastapi import APIRouter

from app.api.v1 import (
    admin,
    admin_bookings,
    admin_custom_services,
    admin_reviews,
    artist_bookings,
    artist_reviews,
    artists,
    bookings,
    directory,
)
from app.modules.auth import router as auth
from app.modules.catalog import admin_router as catalog_admin
from app.modules.catalog import router as catalog
from app.modules.uploads import router as uploads
from app.modules.users import router as users

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(catalog.router)
api_router.include_router(uploads.router)
api_router.include_router(artists.router)
api_router.include_router(artist_bookings.router)
api_router.include_router(artist_reviews.router)
api_router.include_router(directory.router)  # after every /artists/me router: "me" isn't an artist id
api_router.include_router(bookings.router)
api_router.include_router(admin.router)
api_router.include_router(admin_bookings.router)
api_router.include_router(admin_reviews.router)
api_router.include_router(catalog_admin.router)
api_router.include_router(admin_custom_services.router)
