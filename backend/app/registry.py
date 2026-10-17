"""Imports every module's models so `Base.metadata` is complete (Alembic env and tests use it)."""

from app.models import artist, booking, review  # noqa: F401
from app.modules.auth import models as auth_models  # noqa: F401
from app.modules.catalog import models as catalog_models  # noqa: F401
from app.modules.users import models as users_models  # noqa: F401
from app.shared.models import Base

__all__ = ["Base"]
