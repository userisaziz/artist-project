"""Queries over one-time codes and refresh tokens."""

from collections.abc import Sequence
from datetime import datetime

from sqlalchemy import select
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
        return (await self.session.scalars(
            select(OtpCode).where(OtpCode.phone == phone, OtpCode.consumed_at.is_(None))
        )).all()

    async def refresh_token_by_hash(self, token_hash: str) -> RefreshToken | None:
        return await self.session.scalar(select(RefreshToken).where(RefreshToken.token_hash == token_hash))

    def add(self, row: OtpCode | RefreshToken) -> None:
        self.session.add(row)
