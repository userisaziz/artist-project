"""Shared FastAPI dependencies: service construction + current-user resolution."""

import uuid

import jwt as pyjwt
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.exceptions import AuthError, ForbiddenError
from app.core.security import decode_token
from app.models.user import User
from app.services.admin_artist_service import AdminArtistService
from app.services.artist_service import ArtistService
from app.services.auth_service import AuthService
from app.services.category_service import CategoryService
from app.services.custom_service_review import CustomServiceReview
from app.services.service_template_service import ServiceTemplateService
from app.services.storage import ImageStorage, get_storage
from app.services.user_service import UserService
from app.utils.enums import UserRole

bearer_scheme = HTTPBearer(auto_error=True)


def get_auth_service(session: AsyncSession = Depends(get_db)) -> AuthService:
    return AuthService(session)


def get_user_service(session: AsyncSession = Depends(get_db)) -> UserService:
    return UserService(session)


def get_artist_service(
    session: AsyncSession = Depends(get_db), storage: ImageStorage = Depends(get_storage)
) -> ArtistService:
    return ArtistService(session, storage)


def get_category_service(session: AsyncSession = Depends(get_db)) -> CategoryService:
    return CategoryService(session)


def get_service_template_service(session: AsyncSession = Depends(get_db)) -> ServiceTemplateService:
    return ServiceTemplateService(session)


def get_admin_artist_service(session: AsyncSession = Depends(get_db)) -> AdminArtistService:
    return AdminArtistService(session)


def get_custom_service_review(session: AsyncSession = Depends(get_db)) -> CustomServiceReview:
    return CustomServiceReview(session)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    session: AsyncSession = Depends(get_db),
) -> User:
    try:
        payload = decode_token(credentials.credentials)
    except pyjwt.PyJWTError as exc:
        raise AuthError("Invalid token") from exc
    if payload.get("type") != "access":
        raise AuthError("Invalid token type")
    user = await session.get(User, uuid.UUID(payload["sub"]))
    if user is None or not user.is_active:
        raise AuthError("User not found")
    return user


def require_role(role: UserRole):
    """Dependency factory: the signed-in user, or 403 `forbidden` unless they hold `role`
    (whichever side of the mobile app is active — an artist browsing as a customer can still manage their profile)."""

    async def dependency(user: User = Depends(get_current_user)) -> User:
        if role not in user.roles:
            raise ForbiddenError()
        return user

    return dependency


current_artist = require_role(UserRole.artist)
current_admin = require_role(UserRole.admin)
