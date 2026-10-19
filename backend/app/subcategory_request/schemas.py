"""Subcategory request contracts: the artist's suggestion, and the admin queue."""

import uuid
from datetime import datetime
from typing import Annotated

from pydantic import StringConstraints

from app.shared.schemas import APIModel
from app.subcategory_request.constants import DESCRIPTION_MAX_LENGTH, NAME_MAX_LENGTH, SubcategoryRequestStatus

Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=NAME_MAX_LENGTH)]


class SuggestedSubcategoryIn(APIModel):
    parent_id: int  # an active top-level category
    name: Name
    description: Annotated[str, StringConstraints(strip_whitespace=True, max_length=DESCRIPTION_MAX_LENGTH)] | None = (
        None
    )


class SuggestedSubcategoryOut(APIModel):
    """On the artist's own service while it waits on (or came from) their suggestion."""

    id: uuid.UUID
    name: str
    status: SubcategoryRequestStatus


class NamedRef(APIModel):
    id: int
    name: str


class RequestArtist(APIModel):
    id: uuid.UUID
    business_name: str


class SubcategoryRequestOut(APIModel):
    id: uuid.UUID
    name: str
    description: str | None
    parent: NamedRef
    artist: RequestArtist
    services_waiting: int  # the artist's pending services filed under it
    status: SubcategoryRequestStatus
    rejection_reason: str | None
    subcategory_id: int | None
    created_at: datetime
    reviewed_at: datetime | None


class SubcategoryRequestPage(APIModel):
    items: list[SubcategoryRequestOut]  # oldest first
    next_cursor: str | None


class RequestCounts(APIModel):
    pending: int
    approved: int
    rejected: int


class SubcategoryRequestSummary(APIModel):
    counts: RequestCounts
    approved_30d: int
    admin_defaults: int  # active subcategories in the catalog
    oldest_pending_at: datetime | None


class ApproveIn(APIModel):
    name: Name | None = None  # rename before approving; defaults to the artist's wording
