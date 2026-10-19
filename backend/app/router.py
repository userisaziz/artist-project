"""`api_router` (/api/v1): every domain's routers. Each /artists/me… router comes before the directory,
otherwise "me" would be read as an artist id."""

from fastapi import APIRouter

from app.artist import admin_router as artist_admin
from app.artist import router as artist
from app.auth import router as auth
from app.booking import admin_router as admin_bookings
from app.booking import artist_router as artist_bookings
from app.booking import router as bookings
from app.catalog import admin_router as catalog_admin
from app.catalog import router as catalog
from app.chat import artist_router as artist_chat
from app.chat import router as chat
from app.directory import router as directory
from app.feed import artist_router as artist_feed
from app.feed import router as feed
from app.review import admin_router as admin_reviews
from app.review import artist_router as artist_reviews
from app.upload import router as upload
from app.user import router as user

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router)
api_router.include_router(user.router)
api_router.include_router(catalog.router)
api_router.include_router(upload.router)
api_router.include_router(artist.router)
api_router.include_router(artist_bookings.router)
api_router.include_router(artist_reviews.router)
api_router.include_router(artist_chat.router)
api_router.include_router(artist_feed.router)
api_router.include_router(directory.router)  # after every /artists/me router: "me" isn't an artist id
api_router.include_router(bookings.router)
api_router.include_router(chat.router)
api_router.include_router(feed.router)
api_router.include_router(artist_admin.router)
api_router.include_router(admin_bookings.router)
api_router.include_router(admin_reviews.router)
api_router.include_router(catalog_admin.router)
