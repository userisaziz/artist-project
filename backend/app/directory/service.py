"""The public artist directory: approved artists only, their approved services, and free slots."""

import uuid
from datetime import date, timedelta

from fastapi import Depends
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import raiseload

from app.artist.models import ArtistProfile, ArtistServiceItem, artist_categories
from app.artist.schemas import NamedRef
from app.booking import rules
from app.booking.models import Booking
from app.booking.service import busy_ranges
from app.catalog.models import Category, ServiceTemplate
from app.core.database import get_db
from app.core.exceptions import NotFoundError
from app.directory.schemas import (
    ArtistCard,
    ArtistPublic,
    AvailabilityOut,
    PublicPhoto,
    PublicService,
    Slot,
)
from app.review.service import ratings_for
from app.shared import clock
from app.shared.enums import ArtistServiceStatus, ArtistStatus, BookingStatus
from app.shared.pagination import keyset, split_page
from app.shared.search import like_pattern
from app.upload.service import ImageStorage, get_storage

# Approval time; created_at stands in if an approved row somehow lacks it, so paging never meets a NULL.
LISTED_AT = func.coalesce(ArtistProfile.reviewed_at, ArtistProfile.created_at)


def _bookable(services: list[ArtistServiceItem]) -> list[ArtistServiceItem]:
    return [s for s in services if s.status == ArtistServiceStatus.approved]


class DirectoryService:
    def __init__(self, session: AsyncSession, storage: ImageStorage):
        self.session = session
        self.storage = storage

    def _card_fields(self, profile: ArtistProfile, ratings: dict[uuid.UUID, tuple[float, int]]) -> dict:
        prices = [s.price_paise for s in _bookable(profile.services)]
        cover = profile.photos[0].storage_key if profile.photos else None
        rating, review_count = ratings.get(profile.id, (None, 0))
        return {
            "rating": rating, "review_count": review_count,
            "id": profile.id, "business_name": profile.business_name, "city": profile.city,
            "photo_url": self.storage.url(profile.photo_key, "card") if profile.photo_key else None,
            "cover_url": self.storage.url(cover, "card") if cover else None,
            "categories": [NamedRef(id=c.id, name=c.name) for c in profile.categories],
            "from_price_paise": min(prices) if prices else None,
        }

    async def list(self, city: str | None, category_id: int | None, q: str | None,
                   limit: int, cursor: str | None) -> tuple[list[ArtistCard], str | None]:
        """Most recently approved first; keyset paging on (approved-at, id). The public cards never need KYC."""
        query = (
            select(ArtistProfile, LISTED_AT)
            .where(ArtistProfile.status == ArtistStatus.approved)
            .options(raiseload(ArtistProfile.kyc))
        )
        if city:
            query = query.where(ArtistProfile.city == city)
        if category_id is not None:
            query = query.where(ArtistProfile.id.in_(
                select(artist_categories.c.artist_id).where(artist_categories.c.category_id == category_id)
            ))
        if q and q.strip():
            pattern = like_pattern(q)
            offers_it = (
                select(ArtistServiceItem.artist_id)
                .outerjoin(ServiceTemplate, ServiceTemplate.id == ArtistServiceItem.template_id)
                .where(ArtistServiceItem.status == ArtistServiceStatus.approved, or_(
                    ArtistServiceItem.name.ilike(pattern, escape="\\"), ServiceTemplate.name.ilike(pattern, escape="\\"),
                ))
            )
            query = query.where(or_(ArtistProfile.business_name.ilike(pattern, escape="\\"), ArtistProfile.id.in_(offers_it)))
        rows = (await self.session.execute(
            keyset(query, LISTED_AT, ArtistProfile.id, descending=True, cursor=cursor).limit(limit + 1)
        )).all()
        page, next_cursor = split_page(rows, limit, lambda r: (r[1], r[0].id))
        ratings = await ratings_for(self.session, [profile.id for profile, _ in page])
        return [ArtistCard(**self._card_fields(profile, ratings)) for profile, _ in page], next_cursor

    async def _approved(self, artist_id: uuid.UUID) -> ArtistProfile:
        profile = (await self.session.execute(
            select(ArtistProfile)
            .where(ArtistProfile.id == artist_id, ArtistProfile.status == ArtistStatus.approved)
            .options(raiseload(ArtistProfile.kyc))
        )).scalar_one_or_none()
        if profile is None:
            raise NotFoundError("Artist not found")
        return profile

    async def get(self, artist_id: uuid.UUID) -> ArtistPublic:
        profile = await self._approved(artist_id)
        services = _bookable(profile.services)
        # Each service points at a subcategory (or, for older rows, straight at a top-level category).
        own = {c.id: c for c in (await self.session.execute(
            select(Category).where(Category.id.in_({s.category_id for s in services}))
        )).scalars()}
        parents = {c.id: c for c in (await self.session.execute(
            select(Category).where(Category.id.in_({c.parent_id for c in own.values() if c.parent_id}))
        )).scalars()}

        def refs(category_id: int) -> tuple[NamedRef | None, NamedRef | None]:
            cat = own.get(category_id)
            if cat is None:
                return None, None
            if cat.parent_id is None:
                return NamedRef(id=cat.id, name=cat.name), None
            parent = parents[cat.parent_id]
            return NamedRef(id=parent.id, name=parent.name), NamedRef(id=cat.id, name=cat.name)

        completed = (await self.session.execute(
            select(func.count()).select_from(Booking).where(
                Booking.artist_id == profile.id, Booking.status == BookingStatus.completed
            )
        )).scalar_one()
        return ArtistPublic(
            **self._card_fields(profile, await ratings_for(self.session, [profile.id])),
            bio=profile.bio,
            photos=[PublicPhoto(id=p.id, url=self.storage.url(p.storage_key, "full"),
                                thumb_url=self.storage.url(p.storage_key, "thumb")) for p in profile.photos],
            services=[
                PublicService(id=s.id, name=s.display_name, description=s.description, price_paise=s.price_paise,
                              duration_minutes=s.duration_minutes, category=refs(s.category_id)[0],
                              subcategory=refs(s.category_id)[1])
                for s in services
            ],
            member_since=profile.reviewed_at,
            completed_bookings=completed,
        )

    async def availability(self, artist_id: uuid.UUID, day: date, service_id: uuid.UUID) -> AvailabilityOut:
        profile = await self._approved(artist_id)
        service = next((s for s in _bookable(profile.services) if s.id == service_id), None)
        if service is None:
            raise NotFoundError("Service not found")
        now = clock.now()
        rules.check_bookable_day(day, now)
        length = timedelta(minutes=service.duration_minutes)
        starts = rules.slot_starts(day)
        busy = await busy_ranges(self.session, profile.id, starts[0], starts[-1] + length)
        return AvailabilityOut(date=day, slots=[
            Slot(start_at=s, available=rules.is_after_lead_time(s, now)
                 and not any(b_start < s + length and b_end > s for b_start, b_end in busy))
            for s in starts
        ])


def get_directory_service(
    session: AsyncSession = Depends(get_db), storage: ImageStorage = Depends(get_storage)
) -> DirectoryService:
    return DirectoryService(session, storage)
