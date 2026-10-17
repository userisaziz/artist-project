"""Probes for the orchestrator. Liveness never touches the database, so a DB blip doesn't restart pods;
readiness does, and answers 503 so traffic drains while the database is unreachable."""

import logging

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.exceptions import ServiceUnavailableError
from app.health.schemas import LiveOut, ReadyOut

logger = logging.getLogger("art_circle.health")

router = APIRouter(prefix="/health", tags=["health"])


@router.get("/live", response_model=LiveOut, status_code=200, summary="Liveness probe (no dependencies)")
async def live() -> dict:
    return {}


@router.get("/ready", response_model=ReadyOut, status_code=200, summary="Readiness probe (database reachable)")
@router.get("", response_model=ReadyOut, status_code=200, summary="Readiness probe (alias of /health/ready)")
async def ready(session: AsyncSession = Depends(get_db, scope="function")) -> dict:
    try:
        await session.execute(text("SELECT 1"))
    except (SQLAlchemyError, OSError) as exc:
        logger.warning("Readiness check failed: %s", exc.__class__.__name__)
        raise ServiceUnavailableError("Database unreachable") from exc
    return {}
