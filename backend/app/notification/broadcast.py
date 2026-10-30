"""Admin broadcasts: one audience query shared by preview and send; a send writes one inbox row per
recipient (kind `announcement`), queues a push per registered device, and records an immutable row.
The inbox row is the record; a lost push is acceptable, exactly like every other push in the app."""

from datetime import UTC, datetime, time, timedelta
from typing import TYPE_CHECKING, Any

from sqlalchemy import Select, String, exists, func, insert, literal, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.artist.models import ArtistProfile, ArtistServiceItem
from app.catalog.models import Category
from app.notification.constants import ANNOUNCEMENT, BODY_MAX, PENDING_PUSH, TITLE_MAX
from app.notification.models import Notification, NotificationBroadcast, PushDevice
from app.shared.enums import ArtistStatus, UserRole
from app.user.models import User, UserRoleGrant

if TYPE_CHECKING:
    from app.notification.schemas import BroadcastFilters, BroadcastIn

SEGMENT_ROLES: dict[str, tuple[UserRole, ...]] = {
    "all_users": (UserRole.customer, UserRole.artist),
    "all_artists": (UserRole.artist,),
    "all_customers": (UserRole.customer,),
}


def recipient_query(segment: str, f: "BroadcastFilters") -> Select:
    """The exact audience: active users holding the segment's role grant, one row per person.
    Artists pass only at the chosen profile status (`approved` by default); an artist who has not
    built a profile yet still counts. City / category filters join the profile, so any artist-only
    filter inherently narrows the segment to artists — combined with `all_customers` that
    predictably yields nobody."""
    roles = SEGMENT_ROLES[segment]
    status = ArtistStatus(f.artist_status) if f.artist_status else ArtistStatus.approved
    query = (
        select(User.id)
        .join(UserRoleGrant, UserRoleGrant.user_id == User.id)
        .where(User.is_active.is_(True), UserRoleGrant.role.in_(roles))
        .distinct()
    )
    if segment != "all_customers":
        query = query.outerjoin(ArtistProfile, ArtistProfile.user_id == User.id)
        if f.artist_status is None:
            query = query.where(or_(ArtistProfile.id.is_(None), ArtistProfile.status == status))
        else:
            query = query.where(ArtistProfile.status == status)
    if f.joined_from is not None:
        query = query.where(User.created_at >= datetime.combine(f.joined_from, time.min, tzinfo=UTC))
    if f.joined_to is not None:
        query = query.where(User.created_at < datetime.combine(f.joined_to + timedelta(days=1), time.min, tzinfo=UTC))
    if f.artist_status is not None or f.city is not None or f.category_id is not None:
        if segment == "all_customers":
            # An artist-only filter on a customer segment: the inner join makes it predictably empty.
            query = query.join(ArtistProfile, ArtistProfile.user_id == User.id)
            query = query.where(ArtistProfile.status == status)
        if f.city is not None:
            query = query.where(ArtistProfile.city == f.city)
        if f.category_id is not None:
            # Service items point at subcategories; legacy rows point at a top-level category.
            # Matching the chosen id or any of its children covers both (two levels only).
            tree = or_(
                Category.id == f.category_id,
                Category.parent_id == f.category_id,
            )
            query = query.where(
                exists(
                    select(ArtistServiceItem.id)
                    .join(Category, Category.id == ArtistServiceItem.category_id)
                    .where(ArtistServiceItem.artist_id == ArtistProfile.id, tree)
                )
            )
    return query


async def _audience_counts(session: AsyncSession, segment: str, f: "BroadcastFilters") -> dict[str, int]:
    audience = recipient_query(segment, f)
    recipients = (await session.scalar(select(func.count()).select_from(audience.subquery()))) or 0
    with_push = (
        await session.scalar(
            select(func.count(func.distinct(PushDevice.user_id))).where(
                PushDevice.user_id.in_(audience.scalar_subquery())
            )
        )
    ) or 0
    return {"recipients": recipients, "with_push": with_push}


async def preview(session: AsyncSession, segment: str, f: "BroadcastFilters") -> dict[str, int]:
    """The exact numbers the send will produce — preview and send share this code path."""
    return await _audience_counts(session, segment, f)


async def send(session: AsyncSession, me: User, body: "BroadcastIn") -> dict[str, Any] | None:
    """Write the broadcast row, the inbox rows and the pending pushes; None when the audience is empty."""
    counts = await _audience_counts(session, body.segment, body.filters)
    if counts["recipients"] == 0:
        return None
    title, text, link = body.title[:TITLE_MAX], body.body[:BODY_MAX], body.link
    audience = recipient_query(body.segment, body.filters).scalar_subquery()
    broadcast = NotificationBroadcast(
        title=title,
        body=text,
        link=link,
        segment=body.segment,
        filters=body.filters.model_dump(exclude_none=True),
        recipient_count=counts["recipients"],
        push_count=counts["with_push"],
        created_by=me.id,
    )
    session.add(broadcast)
    columns = [Notification.user_id, Notification.kind, Notification.title, Notification.body, Notification.link]
    await session.execute(
        insert(Notification).from_select(
            columns,
            select(
                audience,
                literal(ANNOUNCEMENT, String),
                literal(title, String),
                literal(text, String),
                literal(link, String),
            ),
        )
    )
    tokens = (await session.scalars(select(PushDevice.token).where(PushDevice.user_id.in_(audience)))).all()
    if tokens:
        pending = session.sync_session.info.setdefault(PENDING_PUSH, [])
        pending.extend(
            {"to": t, "title": title, "body": text, "data": {"kind": ANNOUNCEMENT, "link": link}} for t in tokens
        )
    await session.flush()  # eager_defaults: the generated id comes back via RETURNING
    return {"id": broadcast.id, **counts}
