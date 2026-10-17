"""Current-user resolution and role checks shared by every router."""

import uuid

import jwt as pyjwt
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.exceptions import AuthError, ForbiddenError
from app.core.security import decode_token
from app.models.user.user import User
from app.repositories.user.user import UserRepository
from app.shared.enums import UserRole

bearer_scheme = HTTPBearer(auto_error=True)


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
    user = await UserRepository(session).get(uuid.UUID(payload["sub"]))
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
current_customer = require_role(UserRole.customer)
