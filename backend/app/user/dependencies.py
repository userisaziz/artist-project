import uuid

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.shared.clock import Clock, get_clock
from app.upload.service import ImageStorage, get_storage
from app.user.address_service import AddressService
from app.user.models import User, UserAddress
from app.user.service import UserService


def get_user_service(
    session: AsyncSession = Depends(get_db, scope="function"),
    storage: ImageStorage = Depends(get_storage),
    clock: Clock = Depends(get_clock),
) -> UserService:
    return UserService(session, storage, clock)


def get_address_service(
    session: AsyncSession = Depends(get_db, scope="function"),
    clock: Clock = Depends(get_clock),
) -> AddressService:
    return AddressService(session, clock)


async def valid_owned_address(
    address_id: uuid.UUID,
    user: User = Depends(get_current_user),
    service: AddressService = Depends(get_address_service),
) -> UserAddress:
    """The signed-in user's address `address_id`, else 404 (someone else's looks the same as none)."""
    return await service.get_owned(user, address_id)
