"""App factory: builds a fresh FastAPI instance per process (tests rely on this).

Routes stay thin; this file only wires settings, logging, middleware, error handlers and routers.
"""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware

from app import registry  # noqa: F401  (every model mapped before the first request)
from app.auth.config import get_auth_settings
from app.auth.constants import SESSION_TRANSPORT_HEADER
from app.booking.config import get_booking_settings
from app.catalog.config import get_catalog_settings
from app.core.config import get_settings
from app.core.database import engine
from app.core.error_handlers import register_error_handlers
from app.core.logging import configure_logging
from app.core.middleware import BodySizeLimitMiddleware, RequestContextMiddleware, SecurityHeadersMiddleware
from app.health import metrics_router
from app.health import router as health
from app.notification.config import get_notification_settings
from app.review.config import get_review_settings
from app.router import api_router
from app.upload.config import get_upload_settings

# Every module's settings, built at startup so a bad value stops the boot instead of the first request using it.
SETTINGS_GETTERS = (
    get_settings,
    get_auth_settings,
    get_booking_settings,
    get_catalog_settings,
    get_notification_settings,
    get_review_settings,
    get_upload_settings,
)
CORS_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
CORS_HEADERS = ["Authorization", "Content-Type", "X-Request-ID", SESSION_TRANSPORT_HEADER]
GZIP_MIN_BYTES = 1024


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    yield
    await engine.dispose()  # close pooled connections cleanly on shutdown


def create_app() -> FastAPI:
    for load in SETTINGS_GETTERS:
        load()
    settings = get_settings()
    configure_logging(settings.log_level, settings.use_json_logs)
    app = FastAPI(
        title="Art Circle API",
        version="0.1.0",
        lifespan=lifespan,
        openapi_url="/openapi.json" if settings.docs_enabled else None,
        docs_url="/docs" if settings.docs_enabled else None,
        redoc_url="/redoc" if settings.docs_enabled else None,
    )
    # Added innermost first. Request ids wrap all but the security headers, so even rejected requests get one.
    app.add_middleware(GZipMiddleware, minimum_size=GZIP_MIN_BYTES)
    app.add_middleware(BodySizeLimitMiddleware, max_bytes=settings.max_body_bytes)
    app.add_middleware(
        CORSMiddleware,
        # With credentials, Starlette answers a "*" origin list with the caller's concrete Origin, never "*".
        allow_origins=["*"] if settings.environment == "local" else settings.cors_origins,
        allow_credentials=True,  # the admin's httpOnly refresh cookie
        allow_methods=CORS_METHODS,
        allow_headers=CORS_HEADERS,
        expose_headers=["X-Request-ID", "Retry-After"],
        max_age=600,  # browsers may cache the preflight answer for 10 minutes
    )
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.allowed_hosts)
    app.add_middleware(RequestContextMiddleware)
    app.add_middleware(SecurityHeadersMiddleware)  # outermost: even the last-resort 500 gets the headers

    register_error_handlers(app)
    app.include_router(health.router)
    app.include_router(metrics_router.router)
    app.include_router(api_router)
    return app


app = create_app()
