"""Domain enums shared by models and schemas."""

import enum


class UserRole(str, enum.Enum):
    customer = "customer"
    artist = "artist"
    admin = "admin"


class ArtistStatus(str, enum.Enum):
    """Artist profile review state: draft → pending → approved | rejected (→ pending again)."""

    draft = "draft"
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
