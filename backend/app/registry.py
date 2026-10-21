"""Imports every domain's models so `Base.metadata` is complete (Alembic env and tests use it)."""

from app.artist import models as artist_models  # noqa: F401
from app.artist_directory import models as artist_directory_models  # noqa: F401
from app.auth import models as auth_models  # noqa: F401
from app.booking import models as booking_models  # noqa: F401
from app.catalog import models as catalog_models  # noqa: F401
from app.chat import models as chat_models  # noqa: F401
from app.core import rate_limit  # noqa: F401  (core_rate_limit_bucket)
from app.feed import models as feed_models  # noqa: F401
from app.notification import models as notification_models  # noqa: F401
from app.quote import models as quote_models  # noqa: F401
from app.review import models as review_models  # noqa: F401
from app.saved import models as saved_models  # noqa: F401
from app.shared.models import Base
from app.shop import models as shop_models  # noqa: F401
from app.subcategory_request import models as subcategory_request_models  # noqa: F401
from app.support import models as support_models  # noqa: F401
from app.user import models as user_models  # noqa: F401

__all__ = ["Base"]
