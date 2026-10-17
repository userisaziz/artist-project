"""Imports every domain's models so `Base.metadata` is complete (Alembic env and tests use it)."""

from app.artist import models as artist_models  # noqa: F401
from app.auth import models as auth_models  # noqa: F401
from app.booking import models as booking_models  # noqa: F401
from app.catalog import models as catalog_models  # noqa: F401
from app.core import rate_limit  # noqa: F401  (core_rate_limit_bucket)
from app.review import models as review_models  # noqa: F401
from app.shared.models import Base
from app.user import models as user_models  # noqa: F401

__all__ = ["Base"]
