"""Admin view of bookings: every booking with search, cancel with a reason, and the Overview numbers."""

import uuid
from datetime import timedelta

from fastapi import Depends
from sqlalchemy import ColumnElement, Date, cast, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.artist.models import ArtistProfile, ArtistServiceItem
from app.booking import rules
from app.booking.config import BookingSettings, get_booking_settings
from app.booking.models import Booking
from app.booking.service import OPEN, BookingService, rows_query
from app.core.database import get_db
from app.review.models import Review
from app.review.service import needs_moderation
from app.shared import clock
from app.shared.enums import ArtistServiceStatus, ArtistStatus, BookingStatus
from app.shared.search import like_pattern
from app.upload.service import ImageStorage, get_storage
from app.user.models import User

WEEKS = 12


class AdminBookingService(BookingService):
    async def list(self, status: BookingStatus | None, q: str | None, limit: int, cursor: str | None):
        """Newest first. `q` matches the booking code, the customer's phone or the artist's business name."""
        await self.expire_overdue()
        query = rows_query()
        if status:
            query = query.where(Booking.status == status)
        if q and q.strip():
            pattern = like_pattern(q)
            query = query.where(
                or_(
                    Booking.code.ilike(pattern, escape="\\"),
                    User.phone.ilike(pattern, escape="\\"),
                    ArtistProfile.business_name.ilike(pattern, escape="\\"),
                )
            )
        return await self.page(query, Booking.created_at, True, limit, cursor, view="admin")

    async def get(self, booking_id: uuid.UUID) -> dict:
        await self.expire_overdue(Booking.id == booking_id)
        return await self.one(booking_id, view="admin")

    async def cancel(self, booking_id: uuid.UUID, reason: str) -> dict:
        booking = await self.locked(booking_id)
        self.require(booking, *OPEN)
        booking.status = BookingStatus.cancelled
        booking.cancelled_at = clock.now()
        booking.cancelled_by = "admin"
        booking.cancel_reason = reason.strip()
        booking.refund_due = True  # the platform called it off: the customer gets the deposit back
        return await self.save(booking_id, view="admin")

    async def _count(self, model, *where: ColumnElement[bool]) -> int:
        return (await self.session.execute(select(func.count()).select_from(model).where(*where))).scalar_one()

    async def overview(self) -> dict:
        await self.expire_overdue()
        now = clock.now()
        since = now - timedelta(days=30)
        gross = (
            await self.session.execute(
                select(func.coalesce(func.sum(Booking.total_paise), 0)).where(
                    Booking.created_at >= since, Booking.status.not_in((BookingStatus.declined, BookingStatus.expired))
                )
            )
        ).scalar_one()
        return {
            "gross_paise_30d": gross,
            "bookings_30d": await self._count(Booking, Booking.created_at >= since),
            "awaiting_artist": await self._count(Booking, Booking.status == BookingStatus.requested),
            "completed_30d": await self._count(Booking, Booking.completed_at >= since),
            "cancelled_30d": await self._count(Booking, Booking.cancelled_at >= since),
            "pending_artists": await self._count(ArtistProfile, ArtistProfile.status == ArtistStatus.pending),
            "pending_custom_services": await self._count(
                ArtistServiceItem,
                ArtistServiceItem.template_id.is_(None),
                ArtistServiceItem.status == ArtistServiceStatus.pending,
            ),
            "flagged_reviews": await self._count(Review, needs_moderation()),
            "bookings_by_week": await self._weeks(now),
        }

    async def _weeks(self, now) -> list[dict]:
        """Bookings created per IST week (Monday start), oldest first, the current week last."""
        today = rules.ist_today(now)
        this_week = today - timedelta(days=today.weekday())
        weeks = [this_week - timedelta(weeks=i) for i in range(WEEKS - 1, -1, -1)]
        first_start, _ = rules.ist_day_bounds(weeks[0], weeks[0])
        week_of = cast(func.date_trunc("week", func.timezone("Asia/Kolkata", Booking.created_at)), Date)
        rows = await self.session.execute(
            select(week_of, func.count()).where(Booking.created_at >= first_start).group_by(week_of)
        )
        counts = dict(rows.all())
        return [{"week_start": w, "count": counts.get(w, 0)} for w in weeks]


def get_admin_booking_service(
    session: AsyncSession = Depends(get_db),
    storage: ImageStorage = Depends(get_storage),
    settings: BookingSettings = Depends(get_booking_settings),
) -> AdminBookingService:
    return AdminBookingService(session, storage, settings)
