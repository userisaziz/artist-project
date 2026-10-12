# app/models/__init__.py — import all so Alembic autogenerate sees everything
from app.models.base import Base  # noqa: F401
from app.models.user import User, UserRoleGrant  # noqa: F401
from app.models.otp_code import OtpCode  # noqa: F401
from app.models.refresh_token import RefreshToken  # noqa: F401
from app.models.category import Category  # noqa: F401
from app.models.service_template import ServiceTemplate  # noqa: F401
from app.models.artist import ArtistProfile, ArtistServiceItem, PortfolioPhoto, artist_categories  # noqa: F401
