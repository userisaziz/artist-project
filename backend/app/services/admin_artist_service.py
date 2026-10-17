"""Admin review of submitted artist profiles: the queue, one profile, approve / reject."""

import uuid
from datetime import UTC, datetime

from fastapi import Depends
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.crypto import decrypt_aadhaar
from app.core.database import get_db
from app.core.exceptions import ConflictError, NotFoundError
from app.models.artist import AadhaarReveal, ArtistProfile
from app.models.user import User
from app.shared.cursor import decode_cursor, encode_cursor
from app.shared.enums import ArtistStatus


class AdminArtistService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def list(self, status: ArtistStatus, limit: int, cursor: str | None) -> tuple[list[ArtistProfile], str | None]:
        """Oldest submission first; keyset paging on (submitted_at, id) so new submissions never shift pages."""
        query = select(ArtistProfile).where(ArtistProfile.status == status)
        if cursor:
            at, pid = decode_cursor(cursor)
            query = query.where(or_(
                ArtistProfile.submitted_at > at,
                and_(ArtistProfile.submitted_at == at, ArtistProfile.id > pid),
            ))
        rows = (await self.session.scalars(
            query.order_by(ArtistProfile.submitted_at, ArtistProfile.id).limit(limit + 1)
        )).all()
        page = list(rows[:limit])
        return page, encode_cursor(page[-1].submitted_at, page[-1].id) if len(rows) > limit else None

    async def get(self, artist_id: uuid.UUID) -> tuple[ArtistProfile, User]:
        profile = await self.session.get(ArtistProfile, artist_id)
        if profile is None or profile.status == ArtistStatus.draft:  # drafts aren't the admin's business yet
            raise NotFoundError("Artist not found")
        owner = await self.session.get(User, profile.user_id)
        return profile, owner

    async def _decide(self, admin: User, artist_id: uuid.UUID, status: ArtistStatus, reason: str | None) -> tuple[ArtistProfile, User]:
        profile, owner = await self.get(artist_id)
        if profile.status != ArtistStatus.pending:
            raise ConflictError(f"Profile is {profile.status.value}, not pending")
        profile.status = status
        profile.rejection_reason = reason
        profile.reviewed_at = datetime.now(UTC)
        profile.reviewed_by = admin.id
        await self.session.flush()
        return profile, owner

    async def approve(self, admin: User, artist_id: uuid.UUID) -> tuple[ArtistProfile, User]:
        return await self._decide(admin, artist_id, ArtistStatus.approved, None)

    async def reject(self, admin: User, artist_id: uuid.UUID, reason: str) -> tuple[ArtistProfile, User]:
        return await self._decide(admin, artist_id, ArtistStatus.rejected, reason.strip())

    async def reveal_aadhaar(self, admin: User, artist_id: uuid.UUID) -> str:
        """Decrypt one artist's Aadhaar number for an admin, leaving an audit row."""
        profile, _owner = await self.get(artist_id)
        if profile.kyc is None:
            raise NotFoundError("No Aadhaar on file")
        token = profile.kyc.aadhaar_encrypted
        self.session.add(AadhaarReveal(artist_id=profile.id, admin_id=admin.id))
        # Commit now: get_db commits only after the response is sent, and the number must not leave unlogged.
        await self.session.commit()
        return decrypt_aadhaar(token)


def get_admin_artist_service(session: AsyncSession = Depends(get_db)) -> AdminArtistService:
    return AdminArtistService(session)
