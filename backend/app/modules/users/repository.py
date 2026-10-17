"""Queries over users (and, through the selectin relationship, their role grants)."""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.users.models import User


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
