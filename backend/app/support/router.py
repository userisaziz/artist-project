import uuid

from fastapi import APIRouter, Depends, Query

from app.core.auth import get_current_user
from app.shared.responses import errors
from app.support.dependencies import get_support_service, limit_messages, limit_tickets
from app.support.schemas import MessageIn, ReportIn, TicketOut, TicketPage
from app.support.service import SupportService
from app.user.models import User

# Anyone signed in (customer or artist side) reports problems and follows their own tickets.
router = APIRouter(prefix="/support/tickets", tags=["support"], responses=errors(401, 404, 409, 422, 429))


@router.post(
    "", response_model=TicketOut, status_code=201, summary="Report a problem", dependencies=[Depends(limit_tickets)]
)
async def report_problem(
    body: ReportIn, user: User = Depends(get_current_user), support: SupportService = Depends(get_support_service)
) -> dict:
    return await support.report(user, body)


@router.get("", response_model=TicketPage, status_code=200, summary="My tickets, newest first")
async def list_my_tickets(
    limit: int = Query(20, ge=1, le=100),
    cursor: str | None = None,
    user: User = Depends(get_current_user),
    support: SupportService = Depends(get_support_service),
) -> dict:
    items, next_cursor = await support.mine(user, limit, cursor)
    return {"items": items, "next_cursor": next_cursor}


@router.get("/{ticket_id}", response_model=TicketOut, status_code=200, summary="One of my tickets, with its thread")
async def get_my_ticket(
    ticket_id: uuid.UUID, user: User = Depends(get_current_user), support: SupportService = Depends(get_support_service)
) -> dict:
    return await support.my_ticket(user, ticket_id)


@router.post(
    "/{ticket_id}/messages",
    response_model=TicketOut,
    status_code=200,
    summary="Write to support on my ticket",
    dependencies=[Depends(limit_messages)],
)
async def write_to_support(
    ticket_id: uuid.UUID,
    body: MessageIn,
    user: User = Depends(get_current_user),
    support: SupportService = Depends(get_support_service),
) -> dict:
    return await support.write(user, ticket_id, body.text)
