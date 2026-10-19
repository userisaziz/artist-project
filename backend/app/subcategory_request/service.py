"""Suggest (artist, while adding a custom service), then approve into the catalog or reject (admin)."""

import uuid
from datetime import timedelta
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.catalog import service as catalog_service
from app.catalog.models import Category
from app.catalog.schemas import CategoryIn
from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.shared.clock import Clock
from app.shared.enums import CategoryStatus
from app.subcategory_request.constants import APPROVED_WINDOW_DAYS, SubcategoryRequestStatus
from app.subcategory_request.models import SubcategoryRequest
from app.subcategory_request.repository import RequestRow, SubcategoryRequestRepository
from app.subcategory_request.schemas import SuggestedSubcategoryIn

REASON_MAX_LENGTH = 500


def request_out(row: RequestRow) -> dict[str, Any]:
    r = row.request
    return {
        "id": r.id,
        "name": r.name,
        "description": r.description,
        "parent": {"id": r.parent_id, "name": row.parent_name},
        "artist": {"id": r.artist_id, "business_name": row.business_name},
        "services_waiting": row.services_waiting,
        "status": r.status,
        "rejection_reason": r.rejection_reason,
        "subcategory_id": r.subcategory_id,
        "created_at": r.created_at,
        "reviewed_at": r.reviewed_at,
    }


def rejected_service_reason(name: str, reason: str) -> str:
    """What the artist reads on each service that waited on a rejected suggestion."""
    text = f"“{name}” wasn't added as a subcategory: {reason} Pick an existing subcategory and send it again."
    return text[:REASON_MAX_LENGTH]


class SubcategoryRequestService:
    def __init__(self, session: AsyncSession, clock: Clock):
        self.session = session
        self.clock = clock
        self.requests = SubcategoryRequestRepository(session)

    async def suggest(self, artist_id: uuid.UUID, body: SuggestedSubcategoryIn) -> SubcategoryRequest:
        """A new private suggestion under an active top-level category; an existing subcategory name is refused."""
        parent = await self.session.get(Category, body.parent_id)
        if parent is None or parent.parent_id is not None or parent.status != CategoryStatus.active:
            raise ValidationError("Unknown category")
        clash = await self.session.scalar(
            select(Category.name).where(Category.parent_id == parent.id, func.lower(Category.name) == body.name.lower())
        )
        if clash:
            raise ValidationError(f"“{clash}” already exists under {parent.name}. Pick it instead.")
        request = SubcategoryRequest(
            artist_id=artist_id, parent_id=parent.id, name=body.name, description=body.description or None
        )
        self.requests.add(request)
        await self.session.flush()
        return request

    async def withdraw_if_unused(self, request_id: uuid.UUID) -> None:
        """A pending suggestion no service waits on any more disappears: there is nothing left to decide."""
        request = await self.requests.locked(request_id)
        if (
            request
            and request.status == SubcategoryRequestStatus.pending
            and not await self.requests.has_services(request_id)
        ):
            await self.session.delete(request)
            await self.session.flush()

    async def list(self, status: SubcategoryRequestStatus, limit: int, cursor: str | None):
        rows, next_cursor = await self.requests.page(status, limit, cursor)
        return [request_out(r) for r in rows], next_cursor

    async def summary(self) -> dict[str, Any]:
        counts = await self.requests.counts()
        since = self.clock.now() - timedelta(days=APPROVED_WINDOW_DAYS)
        return {
            "counts": {s.value: counts.get(s, 0) for s in SubcategoryRequestStatus},
            "approved_30d": await self.requests.approved_since(since),
            "admin_defaults": await self.requests.active_subcategories(),
            "oldest_pending_at": await self.requests.oldest_pending_at(),
        }

    async def _pending(self, request_id: uuid.UUID) -> SubcategoryRequest:
        request = await self.requests.locked(request_id)
        if request is None:
            raise NotFoundError("Subcategory request not found")
        if request.status != SubcategoryRequestStatus.pending:
            raise ConflictError(f"This request was already {request.status.value}")
        return request

    async def approve(self, request_id: uuid.UUID, name: str | None, admin_id: uuid.UUID) -> dict[str, Any]:
        """It becomes an active subcategory for every artist; its waiting services move into it."""
        request = await self._pending(request_id)
        final = name or request.name
        created = await catalog_service.CategoryService(self.session).create(
            CategoryIn(name=final, status=CategoryStatus.active, parent_id=request.parent_id)
        )
        request.name = final
        request.status = SubcategoryRequestStatus.approved
        request.subcategory_id = created.category.id
        request.reviewed_at = self.clock.now()
        request.reviewed_by_id = admin_id
        await self.requests.move_services(request.id, created.category.id)
        await self.session.flush()
        return request_out(await self.requests.row(request.id))

    async def reject(self, request_id: uuid.UUID, reason: str, admin_id: uuid.UUID) -> dict[str, Any]:
        """Final. The artist's waiting services are sent back so they can pick an existing subcategory."""
        request = await self._pending(request_id)
        request.status = SubcategoryRequestStatus.rejected
        request.rejection_reason = reason
        request.reviewed_at = self.clock.now()
        request.reviewed_by_id = admin_id
        await self.requests.reject_services(request.id, rejected_service_reason(request.name, reason))
        await self.session.flush()
        return request_out(await self.requests.row(request.id))
