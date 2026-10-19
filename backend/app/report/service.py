"""Reports for the admin console: a booking summary for a period and CSV exports, built on demand."""

import csv
import io
from collections.abc import Iterable
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.artist.models import ArtistProfile
from app.core.exceptions import NotFoundError
from app.report.constants import PERIOD_DAYS, REPORTS, Period
from app.report.repository import CATEGORY, ReportRepository, booked_since
from app.shared.clock import Clock
from app.support.constants import ISSUES

RATE_DIGITS = 3
PAISE_PER_RUPEE = 100


def share(part: int, whole: int) -> float | None:
    return round(part / whole, RATE_DIGITS) if whole else None


def iso(value: datetime | None) -> str:
    return value.isoformat() if value else ""


def to_csv(header: list[str], rows: Iterable[Iterable[Any]]) -> str:
    out = io.StringIO()
    writer = csv.writer(out, lineterminator="\n")
    writer.writerow(header)
    writer.writerows(rows)
    return out.getvalue()


class ReportService:
    def __init__(self, session: AsyncSession, clock: Clock):
        self.reports = ReportRepository(session)
        self.clock = clock

    def _since(self, period: Period) -> datetime | None:
        days = PERIOD_DAYS[period]
        return self.clock.now() - timedelta(days=days) if days else None

    async def summary(self, period: Period) -> dict[str, Any]:
        days = PERIOD_DAYS[period]
        since = self._since(period)
        where = booked_since(since)
        bookings, completed = await self.reports.booking_counts(where)
        previous = None
        if since and days:
            before = since - timedelta(days=days)
            previous, _ = await self.reports.booking_counts(booked_since(before))
            previous -= bookings  # bookings from `before` up to now, minus this period's
        city = await self.reports.top(ArtistProfile.city, where, by_category=False)
        category = await self.reports.top(CATEGORY, where, by_category=True)
        return {
            "period_days": days,
            "bookings": bookings,
            "bookings_previous": previous,
            "completed": completed,
            "completion_rate": share(completed, bookings),
            "top_city": {"name": city[0], "share": share(city[1], bookings)} if city else None,
            "top_category": {"name": category[0], "share": share(category[1], bookings)} if category else None,
        }

    async def export(self, report: str, period: Period) -> str:
        if report not in REPORTS:
            raise NotFoundError("No such report")
        since = self._since(period)
        if report == "bookings":
            rows = await self.reports.bookings(booked_since(since))
            return to_csv(
                [
                    "code",
                    "status",
                    "service",
                    "artist",
                    "city",
                    "customer",
                    "customer_phone",
                    "start_at",
                    "created_at",
                    "booking_value_inr",
                ],
                (
                    [
                        r[0],
                        r[1].value,
                        r[2],
                        r[3],
                        r[4],
                        r[5],
                        r[6],
                        iso(r[7]),
                        iso(r[8]),
                        f"{r[9] / PAISE_PER_RUPEE:.2f}",
                    ]
                    for r in rows
                ),
            )
        if report.startswith("bookings_by_"):
            key = report.removeprefix("bookings_by_")
            rows = await self.reports.bookings_grouped(key, booked_since(since))
            return to_csv([key, "bookings", "completed", "cancelled"], ([str(r[0]), r[1], r[2], r[3]] for r in rows))
        if report == "artists":
            rows = await self.reports.artists(since)
            return to_csv(
                ["business_name", "status", "city", "category", "created_at", "approved_at"],
                ([r[0], r[1].value, r[2], r[3] or "", iso(r[4]), iso(r[5])] for r in rows),
            )
        if report == "reviews":
            rows = await self.reports.reviews(since)
            return to_csv(
                ["booking", "artist", "rating", "status", "created_at", "text"],
                ([r[0], r[1], r[2], r[3].value, iso(r[4]), r[5] or ""] for r in rows),
            )
        tickets = await self.reports.tickets(since)
        return to_csv(
            ["code", "subject", "status", "priority", "requester_side", "channel", "created_at", "resolved_at"],
            (
                [
                    t.code,
                    ISSUES[t.topic][t.issue],
                    t.status.value,
                    t.priority.value,
                    t.requester_side,
                    t.channel,
                    iso(t.created_at),
                    iso(t.resolved_at),
                ]
                for t in tickets
            ),
        )
