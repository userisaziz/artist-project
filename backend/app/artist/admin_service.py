"""Admin review of submitted artist profiles: the queue, one profile, approve / reject, and the Aadhaar reveal."""

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.artist.models import AadhaarReveal, ArtistProfile
from app.artist.repository import ArtistRepository
from app.core.crypto import decrypt_aadhaar
from app.core.exceptions import ConflictError, NotFoundError
from app.shared import clock
from app.shared.enums import ArtistStatus
from app.user.models import User
from app.user.repository import UserRepository


class AdminArtistService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.artists = ArtistRepository(session)
        self.users = UserRepository(session)

    async def list(
        self, status: ArtistStatus, limit: int, cursor: str | None
    ) -> tuple[list[ArtistProfile], str | None]:
        """Oldest submission first; keyset paging on (submitted_at, id) so new submissions never shift pages."""
        return await self.artists.page_by_status(status, limit, cursor)

    async def get(self, artist_id: uuid.UUID) -> tuple[ArtistProfile, User]:
        profile = await self.artists.get(artist_id)
        if profile is None or profile.status == ArtistStatus.draft:  # drafts aren't the admin's business yet
            raise NotFoundError("Artist not found")
        owner = await self.users.get(profile.user_id)
        return profile, owner

    async def _decide(
        self, admin: User, artist_id: uuid.UUID, status: ArtistStatus, reason: str | None
    ) -> tuple[ArtistProfile, User]:
        profile, owner = await self.get(artist_id)
        if profile.status != ArtistStatus.pending:
            raise ConflictError(f"Profile is {profile.status.value}, not pending")
        profile.status = status
        profile.rejection_reason = reason
        profile.reviewed_at = clock.now()
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
        self.artists.add(AadhaarReveal(artist_id=profile.id, admin_id=admin.id))
        # Commit now: get_db commits only after the response is sent, and the number must not leave unlogged.
        await self.session.commit()
        return decrypt_aadhaar(token)
