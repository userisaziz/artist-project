"""Subcategory request statuses and the admin queue's limits."""

import enum

REQUESTS_PER_PAGE = 20
NAME_MAX_LENGTH = 100
DESCRIPTION_MAX_LENGTH = 300
APPROVED_WINDOW_DAYS = 30


class SubcategoryRequestStatus(enum.StrEnum):
    """pending: private to the artist who suggested it. approved: it became a real subcategory. rejected: final."""

    pending = "pending"
    approved = "approved"
    rejected = "rejected"
