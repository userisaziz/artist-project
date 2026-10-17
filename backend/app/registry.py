"""Imports every module's models so `Base.metadata` is complete (Alembic env and tests use it)."""

from app.models import (  # noqa: F401
    artist,
    booking,
    category,
    otp_code,
    refresh_token,
    review,
    service_template,
    user,
)
from app.shared.models import Base

__all__ = ["Base"]
