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


class ArtistServiceStatus(str, enum.Enum):
    """Custom services need admin approval; services picked from the admin list are approved on creation."""

    approved = "approved"
    pending = "pending"
    rejected = "rejected"
