"""Admin view of bookings: every booking with search, cancel with a reason, and the Overview numbers."""

import uuid
from datetime import timedelta

from app.artist.models import ArtistProfile, ArtistServiceItem
from app.booking import rules
from app.booking.models import Booking
from app.booking.service import OPEN, BookingService
from app.review.models import Review
from app.review.repository import needs_moderation
from app.shared.enums import ArtistServiceStatus, ArtistStatus, BookingStatus
from app.shared.search import like_pattern
from app.user.models import User

WEEKS = 12


class AdminBookingService(BookingService):
    async def list(self, status: BookingStatus | None, q: str | None, limit: int, cursor: str | None):
        """Newest first. `q` matches the booking code, the customer's phone or the artist's business name."""
        await self.expire_overdue()
        where = []
        if status:
            where.append(Booking.status == status)
        if q and q.strip():
            pattern = like_pattern(q)
            where.append(
                Booking.code.ilike(pattern, escape="\\")
                | User.phone.ilike(pattern, escape="\\")
                | ArtistProfile.business_name.ilike(pattern, escape="\\")
            )
        return await self.page(where, Booking.created_at, True, limit, cursor, view="admin")

    async def get(self, booking_id: uuid.UUID) -> dict:
        await self.expire_overdue(Booking.id == booking_id)
        return await self.one(booking_id, view="admin")

    async def cancel(self, booking_id: uuid.UUID, reason: str) -> dict:
        booking = await self.locked(booking_id)
        self.require(booking, *OPEN)
        booking.status = BookingStatus.cancelled
        booking.cancelled_at = self.clock.now()
        booking.cancelled_by = "admin"
        booking.cancel_reason = reason.strip()
        booking.refund_due = True  # the platform called it off: the customer gets the deposit back
        return await self.save(booking_id, view="admin")

    async def overview(self) -> dict:
        await self.expire_overdue()
        now = self.clock.now()
        since = now - timedelta(days=30)
        count = self.bookings.count
        return {
            "gross_paise_30d": await self.bookings.gross_since(since),
            "bookings_30d": await count(Booking, Booking.created_at >= since),
            "awaiting_artist": await count(Booking, Booking.status == BookingStatus.requested),
            "completed_30d": await count(Booking, Booking.completed_at >= since),
            "cancelled_30d": await count(Booking, Booking.cancelled_at >= since),
            "pending_artists": await count(ArtistProfile, ArtistProfile.status == ArtistStatus.pending),
            "pending_custom_services": await count(
                ArtistServiceItem,
                ArtistServiceItem.template_id.is_(None),
                ArtistServiceItem.status == ArtistServiceStatus.pending,
            ),
            "flagged_reviews": await count(Review, needs_moderation()),
            "bookings_by_week": await self._weeks(now),
        }

    async def _weeks(self, now) -> list[dict]:
        """Bookings created per IST week (Monday start), oldest first, the current week last."""
        today = rules.ist_today(now)
        this_week = today - timedelta(days=today.weekday())
        weeks = [this_week - timedelta(weeks=i) for i in range(WEEKS - 1, -1, -1)]
        first_start, _ = rules.ist_day_bounds(weeks[0], weeks[0])
        counts = await self.bookings.weekly_counts(first_start)
        return [{"week_start": w, "count": counts.get(w, 0)} for w in weeks]
