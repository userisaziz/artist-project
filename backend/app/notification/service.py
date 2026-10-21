"""Notifications: `notify` records an inbox row for a person and queues a push to each of their devices,
sent once the surrounding transaction commits; `notify_admins` fills every active admin's inbox (no push).
The inbox itself: list, unread count, mark read, devices."""

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import String, delete, func, literal, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.artist.models import ArtistProfile
from app.notification.constants import BODY_MAX, PENDING_PUSH, TITLE_MAX, Kind
from app.notification.models import Notification, PushDevice
from app.shared.enums import UserRole
from app.shared.pagination import keyset, split_page
from app.user.models import User, UserRoleGrant


async def notify(
    session: AsyncSession, user_id: uuid.UUID, kind: Kind, title: str, body: str, link: str | None = None
) -> None:
    """Record a notification for `user_id` and queue a push to their devices (sent after commit)."""
    title, body = title[:TITLE_MAX], body[:BODY_MAX]
    session.add(Notification(user_id=user_id, kind=kind, title=title, body=body, link=link))
    tokens = (await session.scalars(select(PushDevice.token).where(PushDevice.user_id == user_id))).all()
    if tokens:
        pending = session.sync_session.info.setdefault(PENDING_PUSH, [])
        pending.extend({"to": t, "title": title, "body": body, "data": {"kind": kind, "link": link}} for t in tokens)


async def notify_artist(
    session: AsyncSession, artist_id: uuid.UUID, kind: Kind, title: str, body: str, link: str | None = None
) -> None:
    """`notify` the account behind an artist profile."""
    user_id = await session.scalar(select(ArtistProfile.user_id).where(ArtistProfile.id == artist_id))
    if user_id is not None:
        await notify(session, user_id, kind, title, body, link)


async def notify_admins(session: AsyncSession, kind: Kind, title: str, body: str, link: str | None = None) -> None:
    """One inbox row per active admin, in a single INSERT ... SELECT. No push: admins work in the web console."""
    admins = (
        select(
            User.id,
            literal(kind, String),
            literal(title[:TITLE_MAX], String),
            literal(body[:BODY_MAX], String),
            literal(link, String),
        )
        .join(UserRoleGrant, UserRoleGrant.user_id == User.id)
        .where(UserRoleGrant.role == UserRole.admin, User.is_active.is_(True))
    )
    columns = [Notification.user_id, Notification.kind, Notification.title, Notification.body, Notification.link]
    await session.execute(insert(Notification).from_select(columns, admins))


def out(n: Notification) -> dict[str, Any]:
    return {
        "id": n.id,
        "kind": n.kind,
        "title": n.title,
        "body": n.body,
        "link": n.link,
        "read_at": n.read_at,
        "created_at": n.created_at,
    }


class NotificationService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def inbox(self, user_id: uuid.UUID, limit: int, cursor: str | None):
        query = keyset(
            select(Notification).where(Notification.user_id == user_id),
            Notification.created_at,
            Notification.id,
            descending=True,
            cursor=cursor,
        )
        rows = list((await self.session.scalars(query.limit(limit + 1))).all())
        page, next_cursor = split_page(rows, limit, lambda n: (n.created_at, n.id))
        return [out(n) for n in page], next_cursor

    async def unread_count(self, user_id: uuid.UUID) -> int:
        return (
            await self.session.execute(
                select(func.count()).where(Notification.user_id == user_id, Notification.read_at.is_(None))
            )
        ).scalar_one()

    async def mark_read(self, user_id: uuid.UUID, ids: list[uuid.UUID] | None, at: datetime) -> None:
        where = [Notification.user_id == user_id, Notification.read_at.is_(None)]
        if ids is not None:
            where.append(Notification.id.in_(ids))
        await self.session.execute(update(Notification).where(*where).values(read_at=at))

    async def register_device(self, user_id: uuid.UUID, token: str, platform: str) -> None:
        """Idempotent; a token signed in on another account moves to this one."""
        await self.session.execute(
            insert(PushDevice)
            .values(token=token, user_id=user_id, platform=platform)
            .on_conflict_do_update(
                index_elements=[PushDevice.token],
                set_={"user_id": user_id, "platform": platform, "updated_at": func.now()},
            )
        )

    async def remove_device(self, user_id: uuid.UUID, token: str) -> None:
        await self.session.execute(delete(PushDevice).where(PushDevice.token == token, PushDevice.user_id == user_id))

    async def forget(self, user_id: uuid.UUID) -> None:
        """Account deletion: the person's devices and whole inbox go."""
        await self.session.execute(delete(PushDevice).where(PushDevice.user_id == user_id))
        await self.session.execute(delete(Notification).where(Notification.user_id == user_id))
