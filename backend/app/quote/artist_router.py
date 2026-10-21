import uuid

from fastapi import APIRouter, Depends, Query

from app.core.auth import current_artist
from app.quote.constants import ArtistView
from app.quote.dependencies import get_quote_service
from app.quote.schemas import DeclineIn, EnquiryOut, EnquiryPage, EnquirySummary, QuoteIn
from app.quote.service import QuoteService
from app.shared.responses import errors
from app.user.models import User

# An approved artist's enquiries. Draft, pending or rejected profiles get 409; another artist's enquiry is 404.
router = APIRouter(prefix="/artists/me/enquiries", tags=["artist enquiries"], responses=errors(401, 403, 404, 409, 422))


@router.get(
    "",
    response_model=EnquiryPage,
    status_code=200,
    summary="My enquiries, newest first",
    description="closed = accepted, declined, cancelled or expired.",
)
async def list_artist_enquiries(
    status: ArtistView | None = None,
    limit: int = Query(20, ge=1, le=100),
    cursor: str | None = None,
    user: User = Depends(current_artist),
    quotes: QuoteService = Depends(get_quote_service),
) -> dict:
    items, next_cursor = await quotes.artist_list(user, status, limit, cursor)
    return {"items": items, "next_cursor": next_cursor}


@router.get("/summary", response_model=EnquirySummary, status_code=200, summary="How many enquiries await me")
async def enquiry_summary(
    user: User = Depends(current_artist), quotes: QuoteService = Depends(get_quote_service)
) -> dict:
    return await quotes.summary(user)


@router.get("/{enquiry_id}", response_model=EnquiryOut, status_code=200, summary="One of my enquiries")
async def get_artist_enquiry(
    enquiry_id: uuid.UUID, user: User = Depends(current_artist), quotes: QuoteService = Depends(get_quote_service)
) -> dict:
    return await quotes.artist_get(user, enquiry_id)


@router.post(
    "/{enquiry_id}/quote",
    response_model=EnquiryOut,
    status_code=200,
    summary="Quote for an enquiry",
    description="Open or quoted enquiries; quoting again replaces the quote. valid_until runs from today (IST) to "
    "the event date.",
)
async def quote_enquiry(
    enquiry_id: uuid.UUID,
    body: QuoteIn,
    user: User = Depends(current_artist),
    quotes: QuoteService = Depends(get_quote_service),
) -> dict:
    return await quotes.quote(user, enquiry_id, body)


@router.post(
    "/{enquiry_id}/decline",
    response_model=EnquiryOut,
    status_code=200,
    summary="Decline an enquiry",
    description="Open or quoted enquiries only.",
)
async def decline_enquiry(
    enquiry_id: uuid.UUID,
    body: DeclineIn,
    user: User = Depends(current_artist),
    quotes: QuoteService = Depends(get_quote_service),
) -> dict:
    return await quotes.decline(user, enquiry_id, body.reason)
