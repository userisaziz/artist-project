from fastapi import APIRouter

from app.api.v1 import (
    admin,
    admin_bookings,
    admin_categories,
    admin_custom_services,
    admin_service_templates,
    artist_bookings,
    artists,
    auth,
    bookings,
    catalog,
    directory,
    uploads,
    users,
)

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(catalog.router)
api_router.include_router(uploads.router)
api_router.include_router(artists.router)
api_router.include_router(artist_bookings.router)
api_router.include_router(directory.router)  # after every /artists/me router: "me" isn't an artist id
api_router.include_router(bookings.router)
api_router.include_router(admin.router)
api_router.include_router(admin_bookings.router)
api_router.include_router(admin_categories.router)
api_router.include_router(admin_service_templates.router)
api_router.include_router(admin_custom_services.router)
