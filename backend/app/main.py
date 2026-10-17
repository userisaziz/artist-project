"""App factory: builds a fresh FastAPI instance per process (tests rely on this).

Routes stay thin; this file only wires middleware, routers, and (later) the
global exception handler.
"""

import logging

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app import registry  # noqa: F401  (every model mapped before the first request)
from app.auth.config import get_auth_settings
from app.booking.config import get_booking_settings
from app.catalog.config import get_catalog_settings
from app.core.config import get_settings
from app.core.database import get_db
from app.core.exceptions import AppError
from app.review.config import get_review_settings
from app.router import api_router
from app.upload.config import get_upload_settings

# Every module's settings, built at startup so a bad value stops the boot instead of the first request using it.
SETTINGS_GETTERS = (
    get_settings,
    get_auth_settings,
    get_booking_settings,
    get_catalog_settings,
    get_review_settings,
    get_upload_settings,
)


def create_app() -> FastAPI:
    for load in SETTINGS_GETTERS:
        load()
    settings = get_settings()
    # Our loggers (e.g. art_circle.sms) have no handler otherwise; console-mode OTPs would vanish.
    logging.basicConfig(level=logging.INFO, format="%(levelname)s:     %(name)s | %(message)s")
    # OpenAPI/docs are a local-and-staging convenience only (best-practices rule).
    docs = "/docs" if settings.docs_enabled else None
    app = FastAPI(
        title="Art Circle API",
        version="0.1.0",
        openapi_url="/openapi.json" if settings.docs_enabled else None,
        docs_url=docs,
        redoc_url="/redoc" if settings.docs_enabled else None,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"] if settings.environment == "local" else settings.cors_origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(api_router)

    @app.exception_handler(AppError)
    async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
        # Domain errors become the stable {code, message} contract the client branches on.
        return JSONResponse(
            status_code=exc.status_code, content={"code": exc.code, "message": exc.message, **exc.details}
        )

    @app.get("/health")
    async def health(session: AsyncSession = Depends(get_db)):
        # Proves the full chain: .env -> Settings -> async engine -> PostgreSQL.
        await session.execute(text("SELECT 1"))
        return {"status": "ok", "db": "ok"}

    return app


app = create_app()
