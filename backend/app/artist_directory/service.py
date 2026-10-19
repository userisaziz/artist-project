"""Admin artist directory: every listed (non-draft) artist with figures, segment counts, KPIs, and suspension.
Suspended artists drop out of everything that requires `approved`: storefront, directory, feed, chat, bookings."""

import uuid
from datetime import timedelta
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.artist.models import ArtistProfile
from app.artist_directory.constants import AT_RISK_RATE, WINDOW_DAYS, DirectoryStatus
from app.artist_directory.models import ArtistSuspension
from app.artist_directory.repository import DirectoryRecord, DirectoryRepository, matches
from app.core.exceptions import ConflictError, NotFoundError
from app.review import service as review_service
from app.shared.clock import Clock
from app.shared.enums import ArtistStatus
from app.shared.pagination import split_page
from app.upload.service import ImageStorage
from app.user.models import User

ONE_DECIMAL = 1


class ArtistDirectoryService:
    def __init__(self, session: AsyncSession, storage: ImageStorage, clock: Clock):
        self.session = session
        self.artists = DirectoryRepository(session)
        self.storage = storage
        self.clock = clock

    def _since(self):
        return self.clock.now() - timedelta(days=WINDOW_DAYS)

    def _row(self, r: DirectoryRecord, ratings: dict) -> dict[str, Any]:
        p = r.profile
        average, count = ratings.get(p.id, (None, 0))
        return {
            "id": p.id,
            "business_name": p.business_name,
            "photo_url": self.storage.url(p.photo_key, "thumb") if p.photo_key else None,
            "category": r.category,
            "city": p.city,
            "status": p.status,
            "rating_average": average,
            "rating_count": count,
            "bookings_total": r.bookings_total,
            "booking_value_30d": r.booking_value,
            "open_complaints": None,
            "created_at": p.created_at,
        }

    async def list(self, status: DirectoryStatus, q: str | None, city: str | None, limit: int, cursor: str | None):
        where = []
        if status != "all":
            where.append(ArtistProfile.status == ArtistStatus(status))
        if city:
            where.append(ArtistProfile.city == city)
        if q and q.strip():
            where.append(matches(q))
        rows = await self.artists.page(self._since(), where, limit=limit, cursor=cursor)
        page, next_cursor = split_page(rows, limit, lambda r: (r.profile.created_at, r.profile.id))
        ratings = await review_service.ratings_for(self.session, [r.profile.id for r in page])
        return [self._row(r, ratings) for r in page], next_cursor

    async def summary(self) -> dict[str, Any]:
        since = self._since()
        counts = await self.artists.counts(since)
        new = counts.pop("new")
        average, reviews = await self.artists.rating()
        median = await self.artists.median_response_minutes(since)
        return {
            "counts": counts,
            "active_artists": counts["approved"],
            "new_this_month": new,
            "avg_rating": review_service.one_decimal(average) if average is not None else None,
            "total_reviews": reviews,
            "median_response_minutes": round(median, ONE_DECIMAL) if median is not None else None,
            "at_risk": await self.artists.at_risk(since, AT_RISK_RATE),
        }

    async def _locked(self, artist_id: uuid.UUID) -> ArtistProfile:
        profile = await self.artists.profile(artist_id)
        if profile is None or profile.status == ArtistStatus.draft:
            raise NotFoundError("Artist not found")
        return profile

    async def _out(self, profile: ArtistProfile) -> dict[str, Any]:
        suspension = await self.artists.suspension(profile.id)
        return {
            "id": profile.id,
            "status": profile.status,
            "suspension_reason": suspension.reason if suspension else None,
            "suspended_at": suspension.suspended_at if suspension else None,
        }

    async def suspend(self, admin: User, artist_id: uuid.UUID, reason: str) -> dict[str, Any]:
        profile = await self._locked(artist_id)
        if profile.status != ArtistStatus.approved:
            raise ConflictError("Only approved artists can be suspended")
        profile.status = ArtistStatus.suspended
        self.artists.add(
            ArtistSuspension(artist_id=profile.id, reason=reason, suspended_at=self.clock.now(), suspended_by=admin.id)
        )
        await self.session.flush()
        return await self._out(profile)

    async def reinstate(self, artist_id: uuid.UUID) -> dict[str, Any]:
        profile = await self._locked(artist_id)
        if profile.status != ArtistStatus.suspended:
            raise ConflictError("This artist isn't suspended")
        profile.status = ArtistStatus.approved
        suspension = await self.artists.suspension(profile.id)
        if suspension:
            await self.artists.delete(suspension)
        await self.session.flush()
        return await self._out(profile)
