import uuid
from typing import Literal

from fastapi import APIRouter, Depends, Query

from app.chat.admin_service import EnquiryAdminService
from app.chat.constants import ENQUIRIES_PER_PAGE, MessageModeration
from app.chat.dependencies import get_enquiry_admin_service
from app.chat.schemas import EnquiryOut, EnquiryPage, EnquirySummary
from app.core.auth import audited_admin
from app.shared.responses import errors
from app.user.models import User

router = APIRouter(
    prefix="/admin/enquiries",
    tags=["admin"],
    dependencies=[Depends(audited_admin)],
    responses=errors(401, 403, 404, 409, 422),
)


@router.get("", response_model=EnquiryPage, status_code=200, summary="Messages the contact filter caught")
async def list_enquiries(
    status: Literal["held", "allowed", "hidden", "all"] = "held",
    limit: int = Query(ENQUIRIES_PER_PAGE, ge=1, le=100),
    cursor: str | None = None,
    enquiries: EnquiryAdminService = Depends(get_enquiry_admin_service),
) -> dict:
    items, next_cursor = await enquiries.list(None if status == "all" else MessageModeration(status), limit, cursor)
    return {"items": items, "next_cursor": next_cursor}


@router.get("/summary", response_model=EnquirySummary, status_code=200, summary="Counts and 7-day figures")
async def enquiry_summary(enquiries: EnquiryAdminService = Depends(get_enquiry_admin_service)) -> dict:
    return await enquiries.summary()


@router.post("/{message_id}/allow", response_model=EnquiryOut, status_code=200, summary="Deliver a held message")
async def allow_enquiry(
    message_id: uuid.UUID,
    admin: User = Depends(audited_admin),
    enquiries: EnquiryAdminService = Depends(get_enquiry_admin_service),
) -> dict:
    return await enquiries.decide(message_id, MessageModeration.allowed, admin.id)


@router.post("/{message_id}/hide", response_model=EnquiryOut, status_code=200, summary="Never deliver a held message")
async def hide_enquiry(
    message_id: uuid.UUID,
    admin: User = Depends(audited_admin),
    enquiries: EnquiryAdminService = Depends(get_enquiry_admin_service),
) -> dict:
    return await enquiries.decide(message_id, MessageModeration.hidden, admin.id)
