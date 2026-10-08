"""App factory: builds a fresh FastAPI instance per process (tests rely on this).

Routes stay thin; this file only wires middleware, routers, and (later) the
global exception handler.
"""

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_db


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="Art Circle API", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"] if settings.debug else [],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health")
    async def health(session: AsyncSession = Depends(get_db)):
        # Proves the full chain: .env -> Settings -> async engine -> PostgreSQL.
        await session.execute(text("SELECT 1"))
        return {"status": "ok", "db": "ok"}

    return app


app = create_app()
