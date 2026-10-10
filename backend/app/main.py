"""App factory: builds a fresh FastAPI instance per process (tests rely on this).

Routes stay thin; this file only wires middleware, routers, and (later) the
global exception handler.
"""

import logging

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.core.database import get_db
from app.core.exceptions import AppError


def create_app() -> FastAPI:
    settings = get_settings()
    # Our loggers (e.g. art_circle.sms) have no handler otherwise; console-mode OTPs would vanish.
    logging.basicConfig(level=logging.INFO, format="%(levelname)s:     %(name)s | %(message)s")
    app = FastAPI(title="Art Circle API", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"] if settings.debug else [],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(api_router)

    @app.exception_handler(AppError)
    async def app_error_handler(request, exc: AppError):
        # Domain errors become the stable {code, message} contract the client branches on.
        return JSONResponse(status_code=exc.status_code, content={"code": exc.code, "message": exc.message})

    @app.get("/health")
    async def health(session: AsyncSession = Depends(get_db)):
        # Proves the full chain: .env -> Settings -> async engine -> PostgreSQL.
        await session.execute(text("SELECT 1"))
        return {"status": "ok", "db": "ok"}

    return app


app = create_app()
