"""Domain enums shared by models and schemas."""

import enum


class UserRole(enum.StrEnum):
    customer = "customer"
    artist = "artist"
    admin = "admin"


class ArtistStatus(enum.StrEnum):
    """Artist profile review state: draft → pending → approved | rejected (→ pending again).
    An admin can suspend an approved artist (hidden, no bookings) and reinstate them to approved."""

    draft = "draft"
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    suspended = "suspended"


class ArtistServiceStatus(enum.StrEnum):
    """Custom services need admin approval; services picked from the admin list are approved on creation."""

    approved = "approved"
    pending = "pending"
    rejected = "rejected"


class CategoryStatus(enum.StrEnum):
    """draft: being set up, admin-only. inactive: no new picks; artists who have it keep it. active: public and pickable."""

    draft = "draft"
    inactive = "inactive"
    active = "active"


class BookingStatus(enum.StrEnum):
    """requested → confirmed → completed; a request can also be declined, expire unanswered, or be cancelled."""

    requested = "requested"
    confirmed = "confirmed"
    declined = "declined"
    expired = "expired"
    cancelled = "cancelled"
    completed = "completed"


class ReviewStatus(enum.StrEnum):
    """published and flagged are public; hidden waits for a moderator out of sight; removed is final."""

    published = "published"
    flagged = "flagged"
    hidden = "hidden"
    removed = "removed"
