from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.notification.schemas import DeviceIn, NotificationPage, ReadIn, UnreadCount
from app.notification.service import NotificationService
from app.shared.clock import Clock, get_clock
from app.shared.responses import errors
from app.user.models import User

router = APIRouter(prefix="/notifications", tags=["notifications"], responses=errors(401, 422))


def get_notification_service(session: AsyncSession = Depends(get_db, scope="function")) -> NotificationService:
    return NotificationService(session)


@router.get("", response_model=NotificationPage, status_code=200, summary="My notifications, newest first")
async def list_notifications(
    limit: int = Query(30, ge=1, le=100),
    cursor: str | None = None,
    user: User = Depends(get_current_user),
    notifications: NotificationService = Depends(get_notification_service),
) -> dict:
    items, next_cursor = await notifications.inbox(user.id, limit, cursor)
    return {"items": items, "next_cursor": next_cursor}


@router.get("/unread-count", response_model=UnreadCount, status_code=200, summary="How many are unread")
async def unread_count(
    user: User = Depends(get_current_user), notifications: NotificationService = Depends(get_notification_service)
) -> dict:
    return {"count": await notifications.unread_count(user.id)}


@router.post("/read", status_code=204, summary="Mark some or all as read", response_class=Response)
async def mark_read(
    body: ReadIn,
    user: User = Depends(get_current_user),
    clock: Clock = Depends(get_clock),
    notifications: NotificationService = Depends(get_notification_service),
) -> None:
    await notifications.mark_read(user.id, body.ids, clock.now())


@router.post("/devices", status_code=204, summary="Register this device for push", response_class=Response)
async def register_device(
    body: DeviceIn,
    user: User = Depends(get_current_user),
    notifications: NotificationService = Depends(get_notification_service),
) -> None:
    await notifications.register_device(user.id, body.token, body.platform)


@router.post(
    "/devices/remove", status_code=204, summary="Stop pushes to this device (sign-out)", response_class=Response
)
async def remove_device(
    body: DeviceIn,
    user: User = Depends(get_current_user),
    notifications: NotificationService = Depends(get_notification_service),
) -> None:
    await notifications.remove_device(user.id, body.token)
