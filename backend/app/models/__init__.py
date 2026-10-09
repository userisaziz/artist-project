# app/models/__init__.py — import all so Alembic autogenerate sees everything
from app.models.base import Base  # noqa: F401
from app.models.user import User  # noqa: F401
from app.models.customer_profile import CustomerProfile  # noqa: F401
from app.models.artist_profile import ArtistProfile  # noqa: F401
from app.models.service import Service  # noqa: F401
from app.models.service_inclusion import ServiceInclusion  # noqa: F401
from app.models.service_addon import ServiceAddon  # noqa: F401
from app.models.artist_availability import ArtistAvailability  # noqa: F401
from app.models.artist_policy import ArtistPolicy  # noqa: F401
from app.models.otp_code import OtpCode  # noqa: F401
from app.models.refresh_token import RefreshToken  # noqa: F401
