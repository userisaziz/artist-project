"""Admin view of customers: the directory, segment counts, one customer's detail, block and unblock.
Blocking deactivates the account: requests with its tokens get 401, and sign-in and refresh are refused."""

import csv
import io
import uuid
from datetime import timedelta
from typing import Any

from sqlalchemy import ColumnElement
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError
from app.customer.constants import ACTIVE_DAYS, EXPORT_COLUMNS, EXPORT_MAX_ROWS, NEW_DAYS, RECENT_BOOKINGS, Segment
from app.customer.repository import BLOCKED, REPEAT, CustomerRecord, CustomerRepository, joined_since, matches
from app.shared.clock import Clock
from app.shared.enums import UserRole
from app.shared.pagination import split_page
from app.user.models import User

UNNAMED = "Unnamed customer"


def full_name(user: User) -> str:
    return " ".join(n for n in (user.first_name, user.last_name) if n) or UNNAMED


class AdminCustomerService:
    def __init__(self, session: AsyncSession, clock: Clock):
        self.session = session
        self.customers = CustomerRepository(session)
        self.clock = clock

    def _new_since(self):
        return self.clock.now() - timedelta(days=NEW_DAYS)

    def _row(self, r: CustomerRecord) -> dict[str, Any]:
        u = r.user
        if not u.is_active:
            status = "blocked"
        elif r.bookings == 0 and u.created_at >= self._new_since():
            status = "new"
        else:
            status = "active"
        return {
            "id": u.id,
            "name": full_name(u),
            "phone": u.phone,
            "email": u.email,
            "city": r.city,
            "bookings": r.bookings,
            "last_booking_at": r.last_booking_at,
            "joined_at": u.created_at,
            "status": status,
        }

    def _where(self, segment: Segment, q: str | None) -> list[ColumnElement[bool]]:
        where: list[ColumnElement[bool]] = []
        if segment == "new":
            where.append(joined_since(self._new_since()))
        elif segment == "repeat":
            where.append(REPEAT)
        elif segment == "blocked":
            where.append(BLOCKED)
        if q and q.strip():
            where.append(matches(q))
        return where

    async def list(self, segment: Segment, q: str | None, limit: int, cursor: str | None):
        rows = await self.customers.page(self._where(segment, q), limit=limit, cursor=cursor)
        page, next_cursor = split_page(rows, limit, lambda r: (r.user.created_at, r.user.id))
        return [self._row(r) for r in page], next_cursor

    async def summary(self) -> dict[str, Any]:
        counts = await self.customers.segment_counts(self._new_since())
        booked = counts.pop("booked")
        return {
            "counts": counts,
            "monthly_active": await self.customers.active_since(self.clock.now() - timedelta(days=ACTIVE_DAYS)),
            "repeat_rate": round(counts["repeat"] / booked, 3) if booked else None,
        }

    async def detail(self, customer_id: uuid.UUID) -> dict[str, Any]:
        record = await self.customers.record(customer_id)
        if record is None:
            raise NotFoundError("Customer not found")
        recent = await self.customers.recent_bookings(customer_id, RECENT_BOOKINGS)
        return {
            **self._row(record),
            "blocked_at": record.user.blocked_at,
            "blocked_reason": record.user.blocked_reason,
            "reviews": await self.customers.review_count(customer_id),
            "recent_bookings": [
                {
                    "id": b.booking.id,
                    "code": b.booking.code,
                    "artist_name": b.artist_name,
                    "service_name": b.booking.service_name,
                    "start_at": b.booking.start_at,
                    "status": b.booking.status,
                    "total_paise": b.booking.total_paise,
                }
                for b in recent
            ],
        }

    async def _customer(self, customer_id: uuid.UUID) -> User:
        user = await self.customers.customer(customer_id)
        if user is None:
            raise NotFoundError("Customer not found")
        return user

    async def block(self, admin: User, customer_id: uuid.UUID, reason: str) -> dict[str, Any]:
        user = await self._customer(customer_id)
        if UserRole.admin in user.roles or user.id == admin.id:
            raise ConflictError("Admin accounts can't be blocked here")
        user.is_active = False
        user.blocked_at = self.clock.now()
        user.blocked_reason = reason
        await self.session.flush()
        return await self.detail(customer_id)

    async def unblock(self, customer_id: uuid.UUID) -> dict[str, Any]:
        user = await self._customer(customer_id)
        user.is_active = True
        user.blocked_at = None
        user.blocked_reason = None
        await self.session.flush()
        return await self.detail(customer_id)

    async def export_csv(self, segment: Segment, q: str | None) -> str:
        rows = await self.customers.all_matching(self._where(segment, q), EXPORT_MAX_ROWS)
        out = io.StringIO()
        writer = csv.DictWriter(out, fieldnames=EXPORT_COLUMNS, lineterminator="\n")
        writer.writeheader()
        for r in rows:
            row = self._row(r)
            writer.writerow(
                {
                    **{k: row[k] for k in ("name", "phone", "email", "city", "bookings", "status")},
                    "last_booking_at": row["last_booking_at"].isoformat() if row["last_booking_at"] else "",
                    "joined_at": row["joined_at"].isoformat(),
                }
            )
        return out.getvalue()
