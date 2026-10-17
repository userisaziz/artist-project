"""Admin review of custom services (artist-proposed, outside the admin's list): the queue, approve, reject."""

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError
from app.repositories.artist.artist import ArtistRepository, CustomServiceRow
from app.shared.enums import ArtistServiceStatus


class CustomServiceReview:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.artists = ArtistRepository(session)

    async def list(
        self, status: ArtistServiceStatus, limit: int, cursor: str | None
    ) -> tuple[list[CustomServiceRow], str | None]:
        """Oldest first; keyset paging on (created_at, id)."""
        return await self.artists.custom_service_page(status, limit, cursor)

    async def _decide(self, service_id: uuid.UUID, status: ArtistServiceStatus, reason: str | None) -> CustomServiceRow:
        row = await self.artists.custom_service(service_id)
        if row is None:
            raise NotFoundError("Custom service not found")
        item = row.item
        if item.status != ArtistServiceStatus.pending:
            raise ConflictError(f"Service is {item.status.value}, not pending")
        item.status = status
        item.rejection_reason = reason
        await self.session.flush()
        return row

    async def approve(self, service_id: uuid.UUID) -> CustomServiceRow:
        return await self._decide(service_id, ArtistServiceStatus.approved, None)

    async def reject(self, service_id: uuid.UUID, reason: str) -> CustomServiceRow:
        return await self._decide(service_id, ArtistServiceStatus.rejected, reason.strip())
