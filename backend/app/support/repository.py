"""Queries over support tickets: one row shape (ticket, requester, assignee, booking) for lists and detail;
queue counts and response KPIs in SQL."""

import uuid
from collections.abc import Sequence
from datetime import datetime
from typing import NamedTuple

from sqlalchemy import ColumnElement, Select, and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.artist.models import ArtistProfile
from app.booking.models import Booking
from app.shared.pagination import keyset
from app.support.constants import TicketPriority, TicketStatus
from app.support.models import Ticket, TicketMessage
from app.user.models import User

RequesterUser = aliased(User, name="requester")
AssigneeUser = aliased(User, name="assignee")
UNRESOLVED = Ticket.status != TicketStatus.resolved


class TicketRow(NamedTuple):
    ticket: Ticket
    requester: User
    assignee: User | None
    booking_code: str | None
    service_name: str | None
    artist_name: str | None


def rows_query() -> Select:
    return (
        select(Ticket, RequesterUser, AssigneeUser, Booking.code, Booking.service_name, ArtistProfile.business_name)
        .join(RequesterUser, RequesterUser.id == Ticket.requester_id)
        .outerjoin(AssigneeUser, AssigneeUser.id == Ticket.assignee_id)
        .outerjoin(Booking, Booking.id == Ticket.booking_id)
        .outerjoin(ArtistProfile, ArtistProfile.id == Booking.artist_id)
    )


class SupportRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def page(self, where: Sequence[ColumnElement[bool]], *, limit: int, cursor: str | None) -> list[TicketRow]:
        """Newest first, keyset on (created_at, id), `limit + 1` rows."""
        query = keyset(rows_query().where(*where), Ticket.created_at, Ticket.id, descending=True, cursor=cursor)
        return [TicketRow(*r) for r in (await self.session.execute(query.limit(limit + 1))).all()]

    async def row(self, ticket_id: uuid.UUID, *scope: ColumnElement[bool]) -> TicketRow | None:
        found = (await self.session.execute(rows_query().where(Ticket.id == ticket_id, *scope))).one_or_none()
        return TicketRow(*found) if found else None

    async def locked(self, ticket_id: uuid.UUID, *scope: ColumnElement[bool]) -> Ticket | None:
        return await self.session.scalar(
            select(Ticket)
            .where(Ticket.id == ticket_id, *scope)
            .with_for_update()
            .execution_options(populate_existing=True)
        )

    async def messages(self, ticket_id: uuid.UUID) -> list[tuple[TicketMessage, User | None]]:
        rows = await self.session.execute(
            select(TicketMessage, User)
            .outerjoin(User, User.id == TicketMessage.author_id)
            .where(TicketMessage.ticket_id == ticket_id)
            .order_by(TicketMessage.created_at, TicketMessage.id)
        )
        return list(rows.all())

    async def counts(self, admin_id: uuid.UUID) -> dict[str, int]:
        row = (
            await self.session.execute(
                select(
                    func.count().filter(UNRESOLVED),
                    func.count().filter(UNRESOLVED, Ticket.assignee_id == admin_id),
                    func.count().filter(UNRESOLVED, Ticket.requester_side == "artist"),
                    func.count().filter(UNRESOLVED, Ticket.requester_side == "customer"),
                    func.count().filter(UNRESOLVED, Ticket.priority == TicketPriority.urgent),
                    func.count().filter(Ticket.status == TicketStatus.resolved),
                ).select_from(Ticket)
            )
        ).one()
        keys = ("open", "mine", "artists", "customers", "urgent", "resolved")
        return dict(zip(keys, row, strict=True))

    async def median_first_response_minutes(self, since: datetime) -> float | None:
        minutes = func.extract("epoch", Ticket.first_response_at - Ticket.created_at) / 60
        value = await self.session.scalar(
            select(func.percentile_cont(0.5).within_group(minutes)).where(
                and_(Ticket.created_at >= since, Ticket.first_response_at.is_not(None))
            )
        )
        return float(value) if value is not None else None

    async def resolved_since(self, since: datetime) -> int:
        return (await self.session.execute(select(func.count()).where(Ticket.resolved_at >= since))).scalar_one()

    async def own_booking(self, booking_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        """The user booked it, or it is with the user's artist profile."""
        artist_ids = select(ArtistProfile.id).where(ArtistProfile.user_id == user_id)
        found = await self.session.scalar(
            select(Booking.id).where(
                Booking.id == booking_id, or_(Booking.customer_id == user_id, Booking.artist_id.in_(artist_ids))
            )
        )
        return found is not None

    async def code_taken(self, code: str) -> bool:
        return await self.session.scalar(select(Ticket.id).where(Ticket.code == code)) is not None

    async def user_by_phone(self, phone: str) -> User | None:
        return await self.session.scalar(select(User).where(User.phone == phone))

    def add(self, row: Ticket | TicketMessage) -> None:
        self.session.add(row)
