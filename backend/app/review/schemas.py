"""Review contracts: public, the reviewer's and artist's own view (with status), and the admin queue."""

import uuid
from datetime import datetime
from typing import Annotated, Literal

from pydantic import Field, StringConstraints, field_validator

from app.shared.enums import ReviewStatus
from app.shared.schemas import APIModel


class ReviewIn(APIModel):
    rating: int = Field(ge=1, le=5)
    text: str | None = Field(default=None, max_length=1000)

    @field_validator("text")
    @classmethod
    def _blank_is_none(cls, value: str | None) -> str | None:
        return (value or "").strip() or None


class ReplyIn(APIModel):
    text: str = Field(max_length=500)  # empty clears the reply


class ReportIn(APIModel):
    reason: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=500)]


class DecisionIn(APIModel):
    decision: Literal["publish", "hide", "remove"]
    note: str | None = Field(default=None, max_length=500)


class ReviewOut(APIModel):
    """What anyone can read on the storefront."""

    id: uuid.UUID
    rating: int
    text: str | None
    reviewer_name: str
    service_name: str
    created_at: datetime
    reply: str | None
    replied_at: datetime | None


class OwnReviewOut(ReviewOut):
    """The reviewer's and the artist's view: also where it stands in moderation."""

    status: ReviewStatus
    flag: str | None
    report_reason: str | None


class ReviewSummary(APIModel):
    average: float | None  # one decimal; None until there's a public review
    count: int
    distribution: dict[str, int]  # "5" … "1"


class ReviewPage(APIModel):
    items: list[ReviewOut]
    next_cursor: str | None
    summary: ReviewSummary


class OwnReviewPage(APIModel):
    items: list[OwnReviewOut]
    next_cursor: str | None
    summary: ReviewSummary


class RefOut(APIModel):
    id: uuid.UUID
    business_name: str


class ReviewCustomer(APIModel):
    id: uuid.UUID
    name: str | None
    phone: str


class ReviewBooking(APIModel):
    id: uuid.UUID
    code: str
    service_name: str


class AdminReviewOut(OwnReviewOut):
    moderator_note: str | None
    moderated_at: datetime | None
    artist: RefOut
    customer: ReviewCustomer
    booking: ReviewBooking


class AdminReviewPage(APIModel):
    items: list[AdminReviewOut]
    next_cursor: str | None
