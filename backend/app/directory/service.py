"""The public artist directory: approved artists only, their approved services, and free slots."""

import uuid
from datetime import date, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.artist import schedule_service as artist_schedule
from app.artist.models import ArtistProfile, ArtistServiceItem
from app.booking import rules
from app.booking.repository import BookingRepository
from app.core.exceptions import NotFoundError
from app.directory.repository import DirectoryRepository
from app.review.service import ratings_for
from app.shared.clock import Clock
from app.shared.enums import ArtistServiceStatus
from app.shared.pagination import split_page
from app.upload.service import ImageStorage


def _bookable(services: list[ArtistServiceItem]) -> list[ArtistServiceItem]:
    return [s for s in services if s.status == ArtistServiceStatus.approved]


class DirectoryService:
    def __init__(self, session: AsyncSession, storage: ImageStorage, clock: Clock):
        self.session = session
        self.artists = DirectoryRepository(session)
        self.storage = storage
        self.clock = clock

    def _card_fields(self, profile: ArtistProfile, ratings: dict[uuid.UUID, tuple[float, int]]) -> dict:
        prices = [s.price_paise for s in _bookable(profile.services)]
        cover = profile.photos[0].storage_key if profile.photos else None
        rating, review_count = ratings.get(profile.id, (None, 0))
        return {
            "rating": rating,
            "review_count": review_count,
            "id": profile.id,
            "business_name": profile.business_name,
            "city": profile.city,
            "photo_url": self.storage.url(profile.photo_key, "card") if profile.photo_key else None,
            "cover_url": self.storage.url(cover, "card") if cover else None,
            "categories": [{"id": c.id, "name": c.name} for c in profile.categories],
            "from_price_paise": min(prices) if prices else None,
        }

    async def cards(self, artist_ids: list[uuid.UUID]) -> list[dict]:
        """Directory cards of whichever of `artist_ids` are approved, in no particular order."""
        if not artist_ids:
            return []
        profiles = await self.artists.approved_many(artist_ids)
        ratings = await ratings_for(self.session, [p.id for p in profiles])
        return [self._card_fields(p, ratings) for p in profiles]

    async def list(
        self, city: str | None, category_id: int | None, q: str | None, limit: int, cursor: str | None
    ) -> tuple[list[dict], str | None]:
        """Most recently approved first; keyset paging on (approved-at, id)."""
        rows = await self.artists.approved_page(city, category_id, q, limit, cursor)
        page, next_cursor = split_page(rows, limit, lambda r: (r[1], r[0].id))
        ratings = await ratings_for(self.session, [profile.id for profile, _ in page])
        return [self._card_fields(profile, ratings) for profile, _ in page], next_cursor

    async def get(self, profile: ArtistProfile) -> dict:
        """`profile` is an approved artist (resolved by the route's `valid_artist_id`)."""
        services = _bookable(profile.services)
        # Each service points at a subcategory (or, for older rows, straight at a top-level category).
        own = await self.artists.categories(s.category_id for s in services)
        parents = await self.artists.categories(c.parent_id for c in own.values() if c.parent_id)

        def refs(category_id: int) -> tuple[dict | None, dict | None]:
            cat = own.get(category_id)
            if cat is None:
                return None, None
            if cat.parent_id is None:
                return {"id": cat.id, "name": cat.name}, None
            parent = parents[cat.parent_id]
            return ({"id": parent.id, "name": parent.name}, {"id": cat.id, "name": cat.name})

        completed = await self.artists.completed_bookings(profile.id)
        return {
            **self._card_fields(profile, await ratings_for(self.session, [profile.id])),
            "bio": profile.bio,
            "photos": [
                {
                    "id": p.id,
                    "url": self.storage.url(p.storage_key, "full"),
                    "thumb_url": self.storage.url(p.storage_key, "thumb"),
                }
                for p in profile.photos
            ],
            "services": [
                {
                    "id": s.id,
                    "name": s.display_name,
                    "description": s.description,
                    "price_paise": s.price_paise,
                    "duration_minutes": s.duration_minutes,
                    "category": refs(s.category_id)[0],
                    "subcategory": refs(s.category_id)[1],
                }
                for s in services
            ],
            "member_since": profile.reviewed_at,
            "completed_bookings": completed,
            "travel_radius_km": profile.travel_radius_km,
            "hours": await artist_schedule.week(self.session, profile.id),
        }

    async def availability(self, profile: ArtistProfile, day: date, service_id: uuid.UUID) -> dict:
        service = next((s for s in _bookable(profile.services) if s.id == service_id), None)
        if service is None:
            raise NotFoundError("Service not found")
        now = self.clock.now()
        rules.check_bookable_day(day, now)
        hours = await artist_schedule.open_hours(self.session, profile.id, day)
        starts = rules.slot_starts(day, hours, service.duration_minutes)
        if not starts:  # a closed weekday or a day off
            return {"date": day, "slots": []}
        length = timedelta(minutes=service.duration_minutes)
        busy = await BookingRepository(self.session).busy_ranges(profile.id, starts[0], starts[-1] + length, now)
        return {
            "date": day,
            "slots": [
                {
                    "start_at": s,
                    "available": rules.is_after_lead_time(s, now)
                    and not any(b_start < s + length and b_end > s for b_start, b_end in busy),
                }
                for s in starts
            ],
        }
