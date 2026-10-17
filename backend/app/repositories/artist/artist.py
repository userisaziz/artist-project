"""Queries over artist profiles, their services and the KYC audit trail."""

import uuid
from typing import NamedTuple

from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.catalog.models import Category
from app.models.artist.artist import AadhaarReveal, ArtistProfile, ArtistServiceItem
from app.shared.enums import ArtistServiceStatus, ArtistStatus
from app.shared.pagination import keyset, split_page

Parent = aliased(Category)


class CustomServiceRow(NamedTuple):
    item: ArtistServiceItem
    business_name: str
    subcategory: Category
    parent: Category | None


def _custom_services() -> Select:
    """Custom (artist-proposed) services with the artist's name, the subcategory and its parent."""
    return (
        select(ArtistServiceItem, ArtistProfile.business_name, Category, Parent)
        .join(ArtistProfile, ArtistProfile.id == ArtistServiceItem.artist_id)
        .join(Category, Category.id == ArtistServiceItem.category_id)
        .outerjoin(Parent, Parent.id == Category.parent_id)
        .where(ArtistServiceItem.template_id.is_(None))
    )


class ArtistRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get(self, artist_id: uuid.UUID) -> ArtistProfile | None:
        return await self.session.get(ArtistProfile, artist_id)

    async def by_user(self, user_id: uuid.UUID) -> ArtistProfile | None:
        return await self.session.scalar(select(ArtistProfile).where(ArtistProfile.user_id == user_id))

    def add(self, row: ArtistProfile | AadhaarReveal) -> None:
        self.session.add(row)

    async def page_by_status(
        self, status: ArtistStatus, limit: int, cursor: str | None
    ) -> tuple[list[ArtistProfile], str | None]:
        """Oldest submission first; keyset on (submitted_at, id)."""
        query = keyset(select(ArtistProfile).where(ArtistProfile.status == status),
                       ArtistProfile.submitted_at, ArtistProfile.id, descending=False, cursor=cursor)
        rows = (await self.session.scalars(query.limit(limit + 1))).all()
        return split_page(rows, limit, lambda p: (p.submitted_at, p.id))

    async def custom_service_page(
        self, status: ArtistServiceStatus, limit: int, cursor: str | None
    ) -> tuple[list[CustomServiceRow], str | None]:
        """Oldest first; keyset on (created_at, id)."""
        query = keyset(_custom_services().where(ArtistServiceItem.status == status),
                       ArtistServiceItem.created_at, ArtistServiceItem.id, descending=False, cursor=cursor)
        rows = [CustomServiceRow(*r) for r in (await self.session.execute(query.limit(limit + 1))).all()]
        return split_page(rows, limit, lambda r: (r.item.created_at, r.item.id))

    async def custom_service(self, service_id: uuid.UUID) -> CustomServiceRow | None:
        row = (await self.session.execute(_custom_services().where(ArtistServiceItem.id == service_id))).one_or_none()
        return CustomServiceRow(*row) if row else None
