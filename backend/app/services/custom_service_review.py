"""Admin review of custom services (artist-proposed, outside the admin's list): the queue, approve, reject."""

import uuid

from fastapi import Depends
from sqlalchemy import Select, and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.core.database import get_db
from app.core.exceptions import ConflictError, NotFoundError
from app.models.artist import ArtistProfile, ArtistServiceItem
from app.models.category import Category
from app.schemas.artist import AdminCustomServiceOut, NamedRef
from app.shared.cursor import decode_cursor, encode_cursor
from app.shared.enums import ArtistServiceStatus

Parent = aliased(Category)


def _query() -> Select:
    return (
        select(ArtistServiceItem, ArtistProfile.business_name, Category, Parent)
        .join(ArtistProfile, ArtistProfile.id == ArtistServiceItem.artist_id)
        .join(Category, Category.id == ArtistServiceItem.category_id)
        .outerjoin(Parent, Parent.id == Category.parent_id)
        .where(ArtistServiceItem.template_id.is_(None))
    )


def _out(item: ArtistServiceItem, business_name: str, subcategory: Category, parent: Category | None) -> AdminCustomServiceOut:
    return AdminCustomServiceOut(
        id=item.id, artist_id=item.artist_id, business_name=business_name,
        category=NamedRef(id=parent.id, name=parent.name) if parent else None,
        subcategory=NamedRef(id=subcategory.id, name=subcategory.name),
        name=item.name, price_paise=item.price_paise, duration_minutes=item.duration_minutes,
        description=item.description, status=item.status, rejection_reason=item.rejection_reason,
        created_at=item.created_at,
    )


class CustomServiceReview:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def list(
        self, status: ArtistServiceStatus, limit: int, cursor: str | None
    ) -> tuple[list[AdminCustomServiceOut], str | None]:
        """Oldest first; keyset paging on (created_at, id)."""
        query = _query().where(ArtistServiceItem.status == status)
        if cursor:
            at, sid = decode_cursor(cursor)
            query = query.where(or_(
                ArtistServiceItem.created_at > at,
                and_(ArtistServiceItem.created_at == at, ArtistServiceItem.id > sid),
            ))
        rows = (await self.session.execute(
            query.order_by(ArtistServiceItem.created_at, ArtistServiceItem.id).limit(limit + 1)
        )).all()
        page = rows[:limit]
        last = page[-1][0] if page else None
        return [_out(*row) for row in page], encode_cursor(last.created_at, last.id) if len(rows) > limit else None

    async def _decide(self, service_id: uuid.UUID, status: ArtistServiceStatus, reason: str | None) -> AdminCustomServiceOut:
        row = (await self.session.execute(_query().where(ArtistServiceItem.id == service_id))).one_or_none()
        if row is None:
            raise NotFoundError("Custom service not found")
        item = row[0]
        if item.status != ArtistServiceStatus.pending:
            raise ConflictError(f"Service is {item.status.value}, not pending")
        item.status = status
        item.rejection_reason = reason
        await self.session.flush()
        return _out(*row)

    async def approve(self, service_id: uuid.UUID) -> AdminCustomServiceOut:
        return await self._decide(service_id, ArtistServiceStatus.approved, None)

    async def reject(self, service_id: uuid.UUID, reason: str) -> AdminCustomServiceOut:
        return await self._decide(service_id, ArtistServiceStatus.rejected, reason.strip())


def get_custom_service_review(session: AsyncSession = Depends(get_db)) -> CustomServiceReview:
    return CustomServiceReview(session)
