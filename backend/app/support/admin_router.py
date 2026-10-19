import uuid

from fastapi import APIRouter, Depends, Query

from app.core.auth import audited_admin
from app.shared.responses import errors
from app.support.constants import QueueView
from app.support.dependencies import get_support_service
from app.support.schemas import AdminReportIn, ReplyIn, SupportSummary, TicketOut, TicketPage, TicketPatch
from app.support.service import SupportService
from app.user.models import User

router = APIRouter(
    prefix="/admin/support",
    tags=["admin support"],
    dependencies=[Depends(audited_admin)],
    responses=errors(401, 403, 404, 409, 422),
)


@router.get("/tickets", response_model=TicketPage, status_code=200, summary="The support queue, newest first")
async def list_tickets(
    view: QueueView = "open",
    limit: int = Query(20, ge=1, le=100),
    cursor: str | None = None,
    admin: User = Depends(audited_admin),
    support: SupportService = Depends(get_support_service),
) -> dict:
    items, next_cursor = await support.queue(admin, view, limit, cursor)
    return {"items": items, "next_cursor": next_cursor}


@router.post("/tickets", response_model=TicketOut, status_code=201, summary="Log a phone request as a ticket")
async def create_ticket(
    body: AdminReportIn, admin: User = Depends(audited_admin), support: SupportService = Depends(get_support_service)
) -> dict:
    return await support.admin_report(admin, body)


@router.get("/summary", response_model=SupportSummary, status_code=200, summary="Queue counts and KPIs")
async def support_summary(
    admin: User = Depends(audited_admin), support: SupportService = Depends(get_support_service)
) -> dict:
    return await support.summary(admin)


@router.get("/tickets/{ticket_id}", response_model=TicketOut, status_code=200, summary="One ticket, with its thread")
async def get_ticket(ticket_id: uuid.UUID, support: SupportService = Depends(get_support_service)) -> dict:
    return await support.get(ticket_id)


@router.post("/tickets/{ticket_id}/reply", response_model=TicketOut, status_code=200, summary="Reply to the requester")
async def reply(
    ticket_id: uuid.UUID,
    body: ReplyIn,
    admin: User = Depends(audited_admin),
    support: SupportService = Depends(get_support_service),
) -> dict:
    return await support.reply(admin, ticket_id, body.text)


@router.post("/tickets/{ticket_id}/assign", response_model=TicketOut, status_code=200, summary="Assign to me")
async def assign_to_me(
    ticket_id: uuid.UUID, admin: User = Depends(audited_admin), support: SupportService = Depends(get_support_service)
) -> dict:
    return await support.assign_to(admin, ticket_id)


@router.patch("/tickets/{ticket_id}", response_model=TicketOut, status_code=200, summary="Set priority or status")
async def update_ticket(
    ticket_id: uuid.UUID, body: TicketPatch, support: SupportService = Depends(get_support_service)
) -> dict:
    return await support.update(ticket_id, body)


@router.post("/tickets/{ticket_id}/close", response_model=TicketOut, status_code=200, summary="Close the ticket")
async def close_ticket(ticket_id: uuid.UUID, support: SupportService = Depends(get_support_service)) -> dict:
    return await support.close(ticket_id)
