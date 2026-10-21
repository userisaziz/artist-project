import uuid
from datetime import date

from fastapi import APIRouter, Depends, Query

from app.core.auth import current_customer
from app.directory.schemas import AvailabilityOut
from app.quote.dependencies import get_quote_service, limit_enquiries
from app.quote.schemas import AcceptIn, AcceptOut, EnquiryIn, EnquiryOut, EnquiryPage
from app.quote.service import QuoteService
from app.shared.responses import errors
from app.user.models import User

# A customer's own enquiries. Someone else's reads as 404, never 403, so ids can't be probed.
router = APIRouter(prefix="/enquiries", tags=["enquiries"], responses=errors(401, 403, 404, 409, 422, 429))


@router.post(
    "",
    response_model=EnquiryOut,
    status_code=201,
    summary="Send an artist an enquiry",
    description="To an approved artist, for an event date from today (IST) up to the booking horizon. "
    "One open or quoted enquiry per artist, and a cap across artists.",
    dependencies=[Depends(limit_enquiries)],
)
async def create_enquiry(
    body: EnquiryIn, user: User = Depends(current_customer), quotes: QuoteService = Depends(get_quote_service)
) -> dict:
    return await quotes.create(user, body)


@router.get("", response_model=EnquiryPage, status_code=200, summary="My enquiries, newest first")
async def list_my_enquiries(
    limit: int = Query(20, ge=1, le=100),
    cursor: str | None = None,
    user: User = Depends(current_customer),
    quotes: QuoteService = Depends(get_quote_service),
) -> dict:
    items, next_cursor = await quotes.customer_list(user, limit, cursor)
    return {"items": items, "next_cursor": next_cursor}


@router.get("/{enquiry_id}", response_model=EnquiryOut, status_code=200, summary="One of my enquiries")
async def get_my_enquiry(
    enquiry_id: uuid.UUID, user: User = Depends(current_customer), quotes: QuoteService = Depends(get_quote_service)
) -> dict:
    return await quotes.customer_get(user, enquiry_id)


@router.post(
    "/{enquiry_id}/cancel",
    response_model=EnquiryOut,
    status_code=200,
    summary="Withdraw my enquiry",
    description="Open or quoted enquiries only.",
)
async def cancel_my_enquiry(
    enquiry_id: uuid.UUID, user: User = Depends(current_customer), quotes: QuoteService = Depends(get_quote_service)
) -> dict:
    return await quotes.cancel(user, enquiry_id)


@router.get(
    "/{enquiry_id}/availability",
    response_model=AvailabilityOut,
    status_code=200,
    summary="Bookable starts for my quote on one day",
    description="The artist's slot grid for the quoted duration. Quoted enquiries only (409 otherwise).",
)
async def get_quote_availability(
    enquiry_id: uuid.UUID,
    date: date = Query(..., description="An IST calendar date, YYYY-MM-DD"),
    user: User = Depends(current_customer),
    quotes: QuoteService = Depends(get_quote_service),
) -> dict:
    return await quotes.availability(user, enquiry_id, date)


@router.post(
    "/{enquiry_id}/accept",
    response_model=AcceptOut,
    status_code=201,
    summary="Accept a quote and book it",
    description="Creates a confirmed booking at the quoted price and duration, at one of the offered starts.",
)
async def accept_quote(
    enquiry_id: uuid.UUID,
    body: AcceptIn,
    user: User = Depends(current_customer),
    quotes: QuoteService = Depends(get_quote_service),
) -> dict:
    return await quotes.accept(user, enquiry_id, body)
