"""Imports every feature's models so `Base.metadata` is complete (Alembic env and tests use it)."""

from app.models import booking, review  # noqa: F401
from app.models.artist import artist  # noqa: F401
from app.models.auth import auth  # noqa: F401
from app.models.catalog import catalog  # noqa: F401
from app.models.user import user  # noqa: F401
from app.shared.models import Base

__all__ = ["Base"]
