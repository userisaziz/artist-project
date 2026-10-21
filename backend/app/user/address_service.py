"""Saved addresses of the signed-in user: at most MAX_SAVED_ADDRESSES, one row per address text (case and
spacing aside), most recently used first."""

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError
from app.shared.clock import Clock
from app.user.constants import MAX_SAVED_ADDRESSES
from app.user.models import User, UserAddress
from app.user.repository import AddressRepository
from app.user.schemas import AddressIn, AddressPatch

LIMIT_MESSAGE = f"You can save up to {MAX_SAVED_ADDRESSES} addresses"
DUPLICATE_MESSAGE = "You already saved this address"


async def forget(session: AsyncSession, user_id: uuid.UUID) -> None:
    """Account deletion: every saved address of the person goes."""
    await AddressRepository(session).forget(user_id)


class AddressService:
    def __init__(self, session: AsyncSession, clock: Clock):
        self.session = session
        self.addresses = AddressRepository(session)
        self.clock = clock

    async def list(self, user: User) -> list[UserAddress]:
        return await self.addresses.list(user.id)

    async def get_owned(self, user: User, address_id: uuid.UUID) -> UserAddress:
        address = await self.addresses.get_owned(user.id, address_id)
        if address is None:
            raise NotFoundError("Address not found")
        return address

    async def add(self, user: User, body: AddressIn) -> tuple[UserAddress, bool]:
        """Returns (address, created). The same text again relabels the existing row instead."""
        await self.addresses.lock_owner(user.id)
        existing = await self.addresses.same_text(user.id, body.address)
        if existing is not None:
            existing.label = body.label
            await self.session.flush()
            return existing, False
        if await self.addresses.count(user.id) >= MAX_SAVED_ADDRESSES:
            raise ConflictError(LIMIT_MESSAGE)
        address = UserAddress(user_id=user.id, label=body.label, address=body.address)
        self.addresses.add(address)
        await self.session.flush()
        await self.session.refresh(address)
        return address, True

    async def update(self, user: User, address: UserAddress, body: AddressPatch) -> UserAddress:
        if body.address is not None:
            await self.addresses.lock_owner(user.id)
            if await self.addresses.same_text(user.id, body.address, other_than=address.id):
                raise ConflictError(DUPLICATE_MESSAGE)
            address.address = body.address
        if body.label is not None:
            address.label = body.label
        await self.session.flush()
        return address

    async def mark_used(self, address: UserAddress) -> None:
        address.last_used_at = self.clock.now()
        await self.session.flush()

    async def delete(self, user: User, address_id: uuid.UUID) -> None:
        """Idempotent for the owner; someone else's id deletes nothing."""
        await self.addresses.delete(user.id, address_id)
