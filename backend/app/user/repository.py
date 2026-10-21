"""Queries over users (and, through the selectin relationship, their role grants) and their saved addresses."""

import uuid

from sqlalchemy import ColumnElement, delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import QueryableAttribute

from app.user.models import User, UserAddress


class UserRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get(self, user_id: uuid.UUID) -> User | None:
        return await self.session.get(User, user_id)

    async def by_phone(self, phone: str) -> User | None:
        return await self.session.scalar(select(User).where(User.phone == phone))

    async def id_by_email(self, email: str) -> uuid.UUID | None:
        return await self.session.scalar(select(User.id).where(User.email == email))

    def add(self, user: User) -> None:
        self.session.add(user)


def address_key(value: QueryableAttribute[str] | ColumnElement[str] | str) -> ColumnElement[str]:
    """Address text compared case-insensitively with runs of whitespace collapsed (in SQL, one rule for both)."""
    return func.lower(func.regexp_replace(value, r"\s+", " ", "g"))


class AddressRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def lock_owner(self, user_id: uuid.UUID) -> None:
        """Serialise one user's address writes so the limit and the duplicate check hold under concurrency."""
        await self.session.execute(select(User.id).where(User.id == user_id).with_for_update())

    async def list(self, user_id: uuid.UUID) -> list[UserAddress]:
        query = (
            select(UserAddress)
            .where(UserAddress.user_id == user_id)
            .order_by(UserAddress.last_used_at.desc().nulls_last(), UserAddress.created_at.desc(), UserAddress.id)
        )
        return list(await self.session.scalars(query))

    async def count(self, user_id: uuid.UUID) -> int:
        return (
            await self.session.scalar(
                select(func.count()).select_from(UserAddress).where(UserAddress.user_id == user_id)
            )
            or 0
        )

    async def get_owned(self, user_id: uuid.UUID, address_id: uuid.UUID) -> UserAddress | None:
        return await self.session.scalar(
            select(UserAddress).where(UserAddress.id == address_id, UserAddress.user_id == user_id)
        )

    async def same_text(
        self, user_id: uuid.UUID, address: str, *, other_than: uuid.UUID | None = None
    ) -> UserAddress | None:
        query = select(UserAddress).where(
            UserAddress.user_id == user_id, address_key(UserAddress.address) == address_key(address)
        )
        if other_than is not None:
            query = query.where(UserAddress.id != other_than)
        return await self.session.scalar(query.limit(1))

    def add(self, address: UserAddress) -> None:
        self.session.add(address)

    async def delete(self, user_id: uuid.UUID, address_id: uuid.UUID) -> None:
        await self.session.execute(
            delete(UserAddress).where(UserAddress.id == address_id, UserAddress.user_id == user_id)
        )

    async def forget(self, user_id: uuid.UUID) -> None:
        await self.session.execute(delete(UserAddress).where(UserAddress.user_id == user_id))
