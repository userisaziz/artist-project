"""Domain enums shared by models and schemas."""

import enum


class UserRole(str, enum.Enum):
    customer = "customer"
    artist = "artist"
    admin = "admin"
