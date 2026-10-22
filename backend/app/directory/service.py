"""The public artist directory: approved artists only, their approved services, and free slots."""

import uuid
from datetime import date, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.artist import schedule_service as artist_schedule
from app.artist.models import ArtistProfile, ArtistServiceItem
from app.artist.utils import addons_out
from app.booking import availability as booking_availability
from app.booking import rules as booking_rules
from app.booking.config import get_booking_settings
from app.chat import service as chat_service
from app.core.exceptions import NotFoundError
from app.directory.constants import AVAILABLE_ON_SCAN_LIMIT, CARD_PHOTOS, NEXT_FREE_LOOKAHEAD_DAYS
from app.directory.repository import DirectoryRepository
from app.directory.utils import SearchFilters
from app.review.service import ratings_for
from app.shared.clock import Clock
from app.shared.cursor import decode_offset_cursor, encode_offset_cursor
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

    def _card_fields(
        self,
        profile: ArtistProfile,
        ratings: dict[uuid.UUID, tuple[float, int]],
        distance_km: float | None = None,
        free_on: date | None = None,
    ) -> dict:
        prices = [s.price_paise for s in _bookable(profile.services)]
        cover = profile.photos[0].storage_key if profile.photos else None
        rating, review_count = ratings.get(profile.id, (None, 0))
        return {
            "rating": rating,
            "review_count": review_count,
            "id": profile.id,
            "business_name": profile.business_name,
            "city": profile.city,
            "locality": profile.locality,
            "photo_url": self.storage.url(profile.photo_key, "card") if profile.photo_key else None,
            "cover_url": self.storage.url(cover, "card") if cover else None,
            "categories": [{"id": c.id, "name": c.name} for c in profile.categories],
            "from_price_paise": min(prices) if prices else None,
            "photo_urls": [self.storage.url(p.storage_key, "card") for p in profile.photos[:CARD_PHOTOS]],
            "distance_km": round(distance_km, 1) if distance_km is not None else None,
            "free_on": free_on,
        }

    async def cards(self, artist_ids: list[uuid.UUID]) -> list[dict]:
        """Directory cards of whichever of `artist_ids` are approved, in no particular order."""
        if not artist_ids:
            return []
        profiles = await self.artists.approved_many(artist_ids)
        ratings = await ratings_for(self.session, [p.id for p in profiles])
        return [self._card_fields(p, ratings) for p in profiles]

    async def list(self, filters: SearchFilters, limit: int, cursor: str | None) -> tuple[list[dict], str | None]:
        """Explore results. The default order (most recently approved) pages by (approved-at, id); every other
        order, and a free-date search, pages by position."""
        if filters.uses_keyset:
            rows = await self.artists.approved_page(filters, limit, cursor)
            page, next_cursor = split_page(rows, limit, lambda r: (r[1], r[0].id))
            found = [(profile, distance, None) for profile, _, distance in page]
        elif filters.available_on is None:
            offset = decode_offset_cursor(cursor) if cursor else 0
            rows = await self.artists.sorted_page(filters, offset, limit + 1)
            found = [(profile, distance, None) for profile, _, distance in rows[:limit]]
            next_cursor = encode_offset_cursor(offset + limit) if len(rows) > limit else None
        else:
            found, next_cursor = await self._free_on(filters, limit, cursor)
        ratings = await ratings_for(self.session, [profile.id for profile, _, _ in found])
        return [self._card_fields(p, ratings, distance, free_on) for p, distance, free_on in found], next_cursor

    async def total(self, filters: SearchFilters) -> int | None:
        """How many artists match; None for a free-date search, which would mean checking every artist's slots."""
        return None if filters.available_on else await self.artists.count(filters)

    async def _free_on(
        self, filters: SearchFilters, limit: int, cursor: str | None
    ) -> tuple[list[tuple[ArtistProfile, float | None, date]], str | None]:
        """Walks the sorted matches, keeping artists with an open slot on `available_on` for their shortest service.
        Scans at most AVAILABLE_ON_SCAN_LIMIT artists per page; the cursor is the next position to check."""
        day = filters.available_on
        offset = decode_offset_cursor(cursor) if cursor else 0
        rows = await self.artists.sorted_page(filters, offset, AVAILABLE_ON_SCAN_LIMIT)
        found: list[tuple[ArtistProfile, float | None, date]] = []
        scanned = 0
        for profile, _, distance in rows:
            if len(found) == limit:
                break
            scanned += 1
            if await self._has_open_slot(profile, day):
                found.append((profile, distance, day))
        more = scanned < len(rows) or len(rows) == AVAILABLE_ON_SCAN_LIMIT
        return found, encode_offset_cursor(offset + scanned) if more else None

    async def _has_open_slot(self, profile: ArtistProfile, day: date) -> bool:
        services = _bookable(profile.services)
        if not services:
            return False
        shortest = min(s.duration_minutes for s in services)
        grid = await booking_availability.day_slots(self.session, profile.id, day, shortest, self.clock.now())
        return any(slot["available"] for slot in grid["slots"])

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
        per_service = await self.artists.completed_by_service(profile.id)
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
                    "booking_count": per_service.get(s.id, 0),
                    "included_items": list(s.included_items),
                    "addons": addons_out(s),
                }
                for s in services
            ],
            "member_since": profile.reviewed_at,
            "completed_bookings": completed,
            "travel_radius_km": profile.travel_radius_km,
            "hours": await artist_schedule.week(self.session, profile.id),
            "next_free_date": await self._next_free_date(profile.id, services),
            "reply_minutes": await chat_service.reply_minutes(self.session, profile.id),
        }

    async def _next_free_date(self, artist_id: uuid.UUID, services: list[ArtistServiceItem]) -> date | None:
        """The first IST day, from today, with an open slot for the artist's shortest bookable service."""
        if not services:
            return None
        shortest = min(s.duration_minutes for s in services)
        now = self.clock.now()
        today = booking_rules.ist_today(now)
        days = min(NEXT_FREE_LOOKAHEAD_DAYS, get_booking_settings().booking_horizon_days + 1)
        for offset in range(days):
            day = today + timedelta(days=offset)
            grid = await booking_availability.day_slots(self.session, artist_id, day, shortest, now)
            if any(slot["available"] for slot in grid["slots"]):
                return day
        return None

    async def availability(self, profile: ArtistProfile, day: date, service_id: uuid.UUID) -> dict:
        service = next((s for s in _bookable(profile.services) if s.id == service_id), None)
        if service is None:
            raise NotFoundError("Service not found")
        return await booking_availability.day_slots(
            self.session, profile.id, day, service.duration_minutes, self.clock.now()
        )
