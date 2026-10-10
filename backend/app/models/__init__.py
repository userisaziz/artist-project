# app/models/__init__.py — import all so Alembic autogenerate sees everything
from app.models.base import Base  # noqa: F401
from app.models.user import User  # noqa: F401
from app.models.otp_code import OtpCode  # noqa: F401
from app.models.refresh_token import RefreshToken  # noqa: F401
