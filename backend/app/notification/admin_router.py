"""Admin broadcast endpoints: count an exact audience, send to it, and list past sends."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import audited_admin
from app.core.database import get_db
from app.core.exceptions import ValidationError
from app.notification import broadcast
from app.notification.schemas import (
    BroadcastIn,
    BroadcastPage,
    BroadcastPreviewIn,
    BroadcastPreviewOut,
    BroadcastSentOut,
)
from app.shared.responses import errors
from app.user.models import User

router = APIRouter(
    prefix="/admin/broadcasts",
    tags=["admin broadcasts"],
    dependencies=[Depends(audited_admin)],
    responses=errors(401, 403, 422),
)


@router.post("/preview", response_model=BroadcastPreviewOut, status_code=200, summary="Count the exact audience")
async def preview_audience(body: BroadcastPreviewIn, session: AsyncSession = Depends(get_db, scope="function")) -> dict:
    return await broadcast.preview(session, body.segment, body.filters)


@router.post("", response_model=BroadcastSentOut, status_code=201, summary="Send to the audience now")
async def send_broadcast(
    body: BroadcastIn, me: User = Depends(audited_admin), session: AsyncSession = Depends(get_db, scope="function")
) -> dict:
    counts = await broadcast.send(session, me, body)
    if counts is None:
        raise ValidationError("This audience has no recipients")
    return counts


@router.get("", response_model=BroadcastPage, status_code=200, summary="Past sends, newest first")
async def broadcast_history(
    limit: int = Query(30, ge=1, le=100),
    cursor: str | None = None,
    session: AsyncSession = Depends(get_db, scope="function"),
) -> dict:
    items, next_cursor = await broadcast.history(session, limit, cursor)
    return {"items": items, "next_cursor": next_cursor}
