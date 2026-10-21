"""Queries over artist profiles, their services and the KYC audit trail."""

import uuid
from datetime import date
from typing import NamedTuple

from sqlalchemy import Select, delete, exists, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.artist.models import AadhaarReveal, ArtistDayOff, ArtistProfile, ArtistServiceItem, ArtistWorkingHour
from app.catalog.models import Category
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
        query = keyset(
            select(ArtistProfile).where(ArtistProfile.status == status),
            ArtistProfile.submitted_at,
            ArtistProfile.id,
            descending=False,
            cursor=cursor,
        )
        rows = (await self.session.scalars(query.limit(limit + 1))).all()
        return split_page(rows, limit, lambda p: (p.submitted_at, p.id))

    async def custom_service_page(
        self, status: ArtistServiceStatus, limit: int, cursor: str | None
    ) -> tuple[list[CustomServiceRow], str | None]:
        """Oldest first; keyset on (created_at, id)."""
        query = keyset(
            _custom_services().where(ArtistServiceItem.status == status),
            ArtistServiceItem.created_at,
            ArtistServiceItem.id,
            descending=False,
            cursor=cursor,
        )
        rows = [CustomServiceRow(*r) for r in (await self.session.execute(query.limit(limit + 1))).all()]
        return split_page(rows, limit, lambda r: (r.item.created_at, r.item.id))

    async def custom_service(self, service_id: uuid.UUID) -> CustomServiceRow | None:
        row = (await self.session.execute(_custom_services().where(ArtistServiceItem.id == service_id))).one_or_none()
        return CustomServiceRow(*row) if row else None


class ScheduleRepository:
    """An artist's weekly hours and days off."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def hours(self, artist_id: uuid.UUID) -> list[ArtistWorkingHour]:
        query = select(ArtistWorkingHour).where(ArtistWorkingHour.artist_id == artist_id)
        return list((await self.session.scalars(query)).all())

    async def hour(self, artist_id: uuid.UUID, weekday: int) -> ArtistWorkingHour | None:
        return await self.session.get(ArtistWorkingHour, (artist_id, weekday))

    async def replace_hours(self, artist_id: uuid.UUID, rows: list[ArtistWorkingHour]) -> None:
        await self.session.execute(delete(ArtistWorkingHour).where(ArtistWorkingHour.artist_id == artist_id))
        self.session.add_all(rows)
        await self.session.flush()

    async def days_off(self, artist_id: uuid.UUID, since: date) -> list[date]:
        query = (
            select(ArtistDayOff.day_date)
            .where(ArtistDayOff.artist_id == artist_id, ArtistDayOff.day_date >= since)
            .order_by(ArtistDayOff.day_date)
        )
        return list((await self.session.scalars(query)).all())

    async def is_day_off(self, artist_id: uuid.UUID, day: date) -> bool:
        query = select(exists().where(ArtistDayOff.artist_id == artist_id, ArtistDayOff.day_date == day))
        return bool(await self.session.scalar(query))

    async def add_day_off(self, artist_id: uuid.UUID, day: date) -> None:
        """Idempotent: adding a day that is already off changes nothing."""
        query = insert(ArtistDayOff).values(artist_id=artist_id, day_date=day).on_conflict_do_nothing()
        await self.session.execute(query)

    async def remove_day_off(self, artist_id: uuid.UUID, day: date) -> None:
        await self.session.execute(
            delete(ArtistDayOff).where(ArtistDayOff.artist_id == artist_id, ArtistDayOff.day_date == day)
        )
