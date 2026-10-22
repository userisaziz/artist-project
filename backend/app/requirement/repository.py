import uuid
from collections.abc import Sequence

from sqlalchemy import exists, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import raiseload

from app.artist.models import ArtistProfile
from app.requirement.constants import Requirement
from app.requirement.models import RequirementNotice, RequirementSetting
from app.requirement.utils import missing, on_hold
from app.shared.enums import ArtistStatus


class RequirementRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def settings(self) -> dict[str, RequirementSetting]:
        rows = await self.session.scalars(select(RequirementSetting))
        return {row.key: row for row in rows}

    def add(self, row: RequirementSetting | RequirementNotice) -> None:
        self.session.add(row)

    async def profile_by_user(self, user_id: uuid.UUID) -> ArtistProfile | None:
        query = select(ArtistProfile).where(ArtistProfile.user_id == user_id).options(raiseload(ArtistProfile.kyc))
        return await self.session.scalar(query)

    async def profile(self, artist_id: uuid.UUID) -> ArtistProfile | None:
        query = select(ArtistProfile).where(ArtistProfile.id == artist_id).options(raiseload(ArtistProfile.kyc))
        return await self.session.scalar(query)

    async def is_on_hold(self, artist_id: uuid.UUID) -> bool:
        return bool(await self.session.scalar(select(exists().where(ArtistProfile.id == artist_id, on_hold()))))

    async def unnoticed(self, requirement: Requirement, stage: str) -> Sequence[uuid.UUID]:
        """Approved artists missing `requirement` who haven't had the `stage` notice for it."""
        sent = exists().where(
            RequirementNotice.artist_id == ArtistProfile.id,
            RequirementNotice.key == requirement.key,
            RequirementNotice.stage == stage,
        )
        query = select(ArtistProfile.id).where(
            ArtistProfile.status == ArtistStatus.approved, missing(requirement), ~sent
        )
        return list(await self.session.scalars(query))
