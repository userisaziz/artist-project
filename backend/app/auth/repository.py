"""Queries over one-time codes and refresh tokens."""

import uuid
from collections.abc import Sequence
from datetime import datetime

from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import OtpCode, RefreshToken


class AuthRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def latest_otp(self, phone: str) -> OtpCode | None:
        return await self.session.scalar(
            select(OtpCode).where(OtpCode.phone == phone).order_by(OtpCode.created_at.desc()).limit(1)
        )

    async def latest_active_otp(self, phone: str, now: datetime) -> OtpCode | None:
        return await self.session.scalar(
            select(OtpCode)
            .where(OtpCode.phone == phone, OtpCode.consumed_at.is_(None), OtpCode.expires_at > now)
            .order_by(OtpCode.created_at.desc())
            .limit(1)
        )

    async def unconsumed_otps(self, phone: str) -> Sequence[OtpCode]:
        return (
            await self.session.scalars(select(OtpCode).where(OtpCode.phone == phone, OtpCode.consumed_at.is_(None)))
        ).all()

    async def refresh_token_by_hash(self, token_hash: str, *, lock: bool = False) -> RefreshToken | None:
        """`lock`: row-lock it, so two refreshes with the same token are serialised and the second sees it revoked."""
        query = select(RefreshToken).where(RefreshToken.token_hash == token_hash)
        if lock:
            query = query.with_for_update().execution_options(populate_existing=True)
        return await self.session.scalar(query)

    async def lock_phone(self, phone: str) -> None:
        """Serialise sign-in work for one phone until the transaction ends (cooldown checks can't race)."""
        await self.session.execute(select(func.pg_advisory_xact_lock(func.hashtext("otp:" + phone))))

    async def revoke_family(self, family_id: uuid.UUID, now: datetime) -> None:
        await self.session.execute(
            update(RefreshToken)
            .where(RefreshToken.family_id == family_id, RefreshToken.revoked_at.is_(None))
            .values(revoked_at=now)
            .execution_options(synchronize_session=False)
        )

    async def delete_refresh_tokens(self, user_id: uuid.UUID) -> None:
        """Every session of the account, revoked or not (account deletion)."""
        await self.session.execute(
            delete(RefreshToken).where(RefreshToken.user_id == user_id).execution_options(synchronize_session=False)
        )

    async def delete(self, row: OtpCode) -> None:
        await self.session.delete(row)

    def add(self, row: OtpCode | RefreshToken) -> None:
        self.session.add(row)
