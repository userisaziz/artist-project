"""Imports every feature's models so `Base.metadata` is complete (Alembic env and tests use it)."""

from app.auth import models as auth_models  # noqa: F401
from app.models import booking, review  # noqa: F401
from app.models.artist import artist  # noqa: F401
from app.models.catalog import catalog  # noqa: F401
from app.shared.models import Base
from app.user import models as user_models  # noqa: F401

__all__ = ["Base"]
