"""Support: people report a problem from the app (or an admin logs a phone request), both sides write in one
thread, and admins work the queue. Status follows the conversation: support replying waits on the user; the
user writing (re)opens it; closing resolves it."""

import secrets
import uuid
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import ColumnElement
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.notification import service as notification_service
from app.shared.clock import Clock
from app.shared.enums import UserRole
from app.shared.pagination import split_page
from app.support.constants import (
    ISSUES,
    RESOLVED_WINDOW_DAYS,
    RESPONSE_WINDOW_DAYS,
    URGENT_ISSUES,
    QueueView,
    TicketPriority,
    TicketStatus,
)
from app.support.models import Ticket, TicketMessage
from app.support.repository import UNRESOLVED, SupportRepository, TicketRow
from app.support.schemas import AdminReportIn, ReportIn, TicketPatch
from app.user.models import User

CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
CODE_TRIES = 5
SUPPORT_NAME = "Atelier support"
ONE_DECIMAL = 1


def person_name(user: User | None, fallback: str) -> str:
    if user is None:
        return fallback
    return " ".join(n for n in (user.first_name, user.last_name) if n) or fallback


def side_of(user: User) -> str:
    return "artist" if user.active_role == UserRole.artist else "customer"


class SupportService:
    def __init__(self, session: AsyncSession, clock: Clock):
        self.session = session
        self.tickets = SupportRepository(session)
        self.clock = clock

    # --- shaping --------------------------------------------------------------------------------

    async def _out(self, row: TicketRow, *, with_messages: bool) -> dict[str, Any]:
        t = row.ticket
        awaiting = t.status in (TicketStatus.new, TicketStatus.open)
        messages = await self.tickets.messages(t.id) if with_messages else []
        return {
            "id": t.id,
            "code": t.code,
            "subject": ISSUES[t.topic][t.issue],
            "topic": t.topic,
            "issue": t.issue,
            "status": t.status,
            "priority": t.priority,
            "channel": t.channel,
            "requester": {
                "id": row.requester.id,
                "name": person_name(row.requester, row.requester.phone),
                "phone": row.requester.phone,
                "side": t.requester_side,
            },
            "assignee": {"id": row.assignee.id, "name": person_name(row.assignee, "Admin")} if row.assignee else None,
            "booking": {
                "id": t.booking_id,
                "code": row.booking_code,
                "service_name": row.service_name,
                "artist_name": row.artist_name,
            }
            if t.booking_id and row.booking_code
            else None,
            "created_at": t.created_at,
            "waiting_since": t.last_requester_at if awaiting else None,
            "messages": [
                {
                    "id": m.id,
                    "author": m.author,
                    "author_name": SUPPORT_NAME if m.author == "support" else person_name(row.requester, "You"),
                    "text": m.text,
                    "created_at": m.created_at,
                }
                for m, _author in messages
            ],
        }

    async def _detail(self, ticket_id: uuid.UUID, *scope: ColumnElement[bool]) -> dict[str, Any]:
        row = await self.tickets.row(ticket_id, *scope)
        if row is None:
            raise NotFoundError("Ticket not found")
        return await self._out(row, with_messages=True)

    async def _page(self, where: list[ColumnElement[bool]], limit: int, cursor: str | None):
        rows = await self.tickets.page(where, limit=limit, cursor=cursor)
        page, next_cursor = split_page(rows, limit, lambda r: (r.ticket.created_at, r.ticket.id))
        return [await self._out(r, with_messages=False) for r in page], next_cursor

    # --- opening ----------------------------------------------------------------------------------

    async def _new_code(self) -> str:
        for _ in range(CODE_TRIES):
            code = "T-" + "".join(secrets.choice(CODE_ALPHABET) for _ in range(6))
            if not await self.tickets.code_taken(code):
                return code
        raise ConflictError("Couldn't open the ticket. Please try again.")

    async def _check_issue(self, requester: User, topic: str, issue: str, booking_id: uuid.UUID | None) -> None:
        if issue not in ISSUES[topic]:
            raise ValidationError(f"Pick one of the {topic} issues")
        if topic == "booking" and booking_id is None:
            raise ValidationError("Pick the booking this is about")
        if booking_id and not await self.tickets.customer_booking(booking_id, requester.id):
            raise NotFoundError("Booking not found")

    async def _open(
        self, requester: User, topic: str, issue: str, booking_id, channel: str, text: str | None, author_id
    ) -> uuid.UUID:
        now = self.clock.now()
        ticket = Ticket(
            code=await self._new_code(),
            requester_id=requester.id,
            requester_side=side_of(requester),
            topic=topic,
            issue=issue,
            booking_id=booking_id if topic == "booking" else None,
            channel=channel,
            status=TicketStatus.new,
            priority=TicketPriority.urgent if issue in URGENT_ISSUES else TicketPriority.normal,
            last_requester_at=now,
        )
        self.tickets.add(ticket)
        await self.session.flush()
        if text:
            self.tickets.add(
                TicketMessage(ticket_id=ticket.id, author="requester", author_id=author_id, text=text, created_at=now)
            )
            await self.session.flush()
        return ticket.id

    async def report(self, requester: User, data: ReportIn) -> dict[str, Any]:
        await self._check_issue(requester, data.topic, data.issue, data.booking_id)
        ticket_id = await self._open(
            requester, data.topic, data.issue, data.booking_id, "app", data.details or None, requester.id
        )
        return await self._detail(ticket_id)

    async def admin_report(self, admin: User, data: AdminReportIn) -> dict[str, Any]:
        requester = await self.tickets.user_by_phone(data.phone)
        if requester is None:
            raise NotFoundError("No account with that phone number")
        await self._check_issue(requester, data.topic, data.issue, data.booking_id)
        ticket_id = await self._open(
            requester, data.topic, data.issue, data.booking_id, "phone", data.message, admin.id
        )
        return await self._detail(ticket_id)

    # --- requester ------------------------------------------------------------------------------

    async def mine(self, requester: User, limit: int, cursor: str | None):
        return await self._page([Ticket.requester_id == requester.id], limit, cursor)

    async def my_ticket(self, requester: User, ticket_id: uuid.UUID) -> dict[str, Any]:
        return await self._detail(ticket_id, Ticket.requester_id == requester.id)

    async def write(self, requester: User, ticket_id: uuid.UUID, text: str) -> dict[str, Any]:
        """The requester writing again reopens a ticket support had answered or closed."""
        ticket = await self.tickets.locked(ticket_id, Ticket.requester_id == requester.id)
        if ticket is None:
            raise NotFoundError("Ticket not found")
        now = self.clock.now()
        self.tickets.add(
            TicketMessage(ticket_id=ticket.id, author="requester", author_id=requester.id, text=text, created_at=now)
        )
        if ticket.status != TicketStatus.new:
            ticket.status = TicketStatus.open
            ticket.resolved_at = None
        ticket.last_requester_at = now
        await self.session.flush()
        return await self._detail(ticket_id)

    # --- admin ------------------------------------------------------------------------------------

    def _view(self, admin: User, view: QueueView) -> list[ColumnElement[bool]]:
        if view == "resolved":
            return [Ticket.status == TicketStatus.resolved]
        where: list[ColumnElement[bool]] = [UNRESOLVED]
        if view == "mine":
            where.append(Ticket.assignee_id == admin.id)
        elif view == "artists":
            where.append(Ticket.requester_side == "artist")
        elif view == "customers":
            where.append(Ticket.requester_side == "customer")
        elif view == "urgent":
            where.append(Ticket.priority == TicketPriority.urgent)
        return where

    async def queue(self, admin: User, view: QueueView, limit: int, cursor: str | None):
        return await self._page(self._view(admin, view), limit, cursor)

    async def summary(self, admin: User) -> dict[str, Any]:
        now = self.clock.now()
        median = await self.tickets.median_first_response_minutes(now - timedelta(days=RESPONSE_WINDOW_DAYS))
        return {
            "counts": await self.tickets.counts(admin.id),
            "first_response_minutes": round(median, ONE_DECIMAL) if median is not None else None,
            "resolved_7d": await self.tickets.resolved_since(now - timedelta(days=RESOLVED_WINDOW_DAYS)),
        }

    async def get(self, ticket_id: uuid.UUID) -> dict[str, Any]:
        return await self._detail(ticket_id)

    async def _locked(self, ticket_id: uuid.UUID) -> Ticket:
        ticket = await self.tickets.locked(ticket_id)
        if ticket is None:
            raise NotFoundError("Ticket not found")
        return ticket

    async def reply(self, admin: User, ticket_id: uuid.UUID, text: str) -> dict[str, Any]:
        ticket = await self._locked(ticket_id)
        now = self.clock.now()
        self.tickets.add(
            TicketMessage(ticket_id=ticket.id, author="support", author_id=admin.id, text=text, created_at=now)
        )
        ticket.status = TicketStatus.waiting_on_user
        ticket.first_response_at = ticket.first_response_at or now
        ticket.resolved_at = None
        ticket.assignee_id = ticket.assignee_id or admin.id
        await notification_service.notify(
            self.session,
            ticket.requester_id,
            "support_reply",
            "Support replied",
            text[:120],
            f"/customer/support/{ticket.id}",
        )
        await self.session.flush()
        return await self._detail(ticket_id)

    async def assign_to(self, admin: User, ticket_id: uuid.UUID) -> dict[str, Any]:
        ticket = await self._locked(ticket_id)
        ticket.assignee_id = admin.id
        await self.session.flush()
        return await self._detail(ticket_id)

    async def update(self, ticket_id: uuid.UUID, patch: TicketPatch) -> dict[str, Any]:
        ticket = await self._locked(ticket_id)
        if patch.priority:
            ticket.priority = patch.priority
        if patch.status:
            self._set_status(ticket, patch.status)
        await self.session.flush()
        return await self._detail(ticket_id)

    async def close(self, ticket_id: uuid.UUID) -> dict[str, Any]:
        ticket = await self._locked(ticket_id)
        self._set_status(ticket, TicketStatus.resolved)
        await self.session.flush()
        return await self._detail(ticket_id)

    def _set_status(self, ticket: Ticket, status: TicketStatus) -> None:
        ticket.status = status
        ticket.resolved_at = self._now() if status == TicketStatus.resolved else None

    def _now(self) -> datetime:
        return self.clock.now()
