"""Queries over subcategory requests; the waiting-services count is a correlated subquery, not Python."""

import uuid
from datetime import datetime
from typing import NamedTuple

from sqlalchemy import Select, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.artist.models import ArtistProfile, ArtistServiceItem
from app.catalog.models import Category
from app.shared.enums import ArtistServiceStatus, CategoryStatus
from app.shared.pagination import keyset, split_page
from app.subcategory_request.constants import SubcategoryRequestStatus
from app.subcategory_request.models import SubcategoryRequest


class RequestRow(NamedTuple):
    request: SubcategoryRequest
    parent_name: str
    business_name: str
    services_waiting: int


def _rows() -> Select:
    waiting = (
        select(func.count())
        .where(
            ArtistServiceItem.suggestion_id == SubcategoryRequest.id,
            ArtistServiceItem.status == ArtistServiceStatus.pending,
        )
        .scalar_subquery()
    )
    return (
        select(SubcategoryRequest, Category.name, ArtistProfile.business_name, waiting)
        .join(Category, Category.id == SubcategoryRequest.parent_id)
        .join(ArtistProfile, ArtistProfile.id == SubcategoryRequest.artist_id)
    )


class SubcategoryRequestRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    def add(self, request: SubcategoryRequest) -> None:
        self.session.add(request)

    async def locked(self, request_id: uuid.UUID) -> SubcategoryRequest | None:
        return await self.session.scalar(
            select(SubcategoryRequest).where(SubcategoryRequest.id == request_id).with_for_update()
        )

    async def row(self, request_id: uuid.UUID) -> RequestRow:
        return RequestRow(*(await self.session.execute(_rows().where(SubcategoryRequest.id == request_id))).one())

    async def page(
        self, status: SubcategoryRequestStatus, limit: int, cursor: str | None
    ) -> tuple[list[RequestRow], str | None]:
        """Oldest first; keyset on (created_at, id)."""
        query = keyset(
            _rows().where(SubcategoryRequest.status == status),
            SubcategoryRequest.created_at,
            SubcategoryRequest.id,
            descending=False,
            cursor=cursor,
        )
        rows = [RequestRow(*r) for r in (await self.session.execute(query.limit(limit + 1))).all()]
        return split_page(rows, limit, lambda r: (r.request.created_at, r.request.id))

    async def counts(self) -> dict[SubcategoryRequestStatus, int]:
        rows = await self.session.execute(
            select(SubcategoryRequest.status, func.count()).group_by(SubcategoryRequest.status)
        )
        return dict(rows.all())

    async def approved_since(self, since: datetime) -> int:
        return await self._count(
            select(func.count()).where(
                SubcategoryRequest.status == SubcategoryRequestStatus.approved, SubcategoryRequest.reviewed_at >= since
            )
        )

    async def oldest_pending_at(self) -> datetime | None:
        return await self.session.scalar(
            select(func.min(SubcategoryRequest.created_at)).where(
                SubcategoryRequest.status == SubcategoryRequestStatus.pending
            )
        )

    async def active_subcategories(self) -> int:
        return await self._count(
            select(func.count()).where(Category.parent_id.is_not(None), Category.status == CategoryStatus.active)
        )

    async def move_services(self, request_id: uuid.UUID, subcategory_id: int) -> None:
        """The request's waiting services now sit in the subcategory it became; they still need their own review."""
        await self.session.execute(
            update(ArtistServiceItem)
            .where(ArtistServiceItem.suggestion_id == request_id)
            .values(category_id=subcategory_id)
            .execution_options(synchronize_session=False)
        )

    async def reject_services(self, request_id: uuid.UUID, reason: str) -> None:
        await self.session.execute(
            update(ArtistServiceItem)
            .where(
                ArtistServiceItem.suggestion_id == request_id,
                ArtistServiceItem.status == ArtistServiceStatus.pending,
            )
            .values(status=ArtistServiceStatus.rejected, rejection_reason=reason)
            .execution_options(synchronize_session=False)
        )

    async def _count(self, query) -> int:
        return (await self.session.execute(query)).scalar_one()

    async def has_services(self, request_id: uuid.UUID) -> bool:
        found = await self.session.scalar(
            select(ArtistServiceItem.id).where(ArtistServiceItem.suggestion_id == request_id).limit(1)
        )
        return found is not None
