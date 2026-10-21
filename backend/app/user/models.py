"""Accounts: the users table, the roles each account holds (user_roles, migration #4) and the account's saved
addresses."""

import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.shared.enums import UserRole
from app.shared.models import Base, TimestampMixin

user_role_enum = Enum(UserRole, name="user_role", values_callable=lambda e: [m.value for m in e])


class User(Base, TimestampMixin):
    __tablename__ = "user_account"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
    )
    phone: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), unique=True)
    password_hash: Mapped[str | None] = mapped_column(Text)
    first_name: Mapped[str | None] = mapped_column(String(100))
    last_name: Mapped[str | None] = mapped_column(String(100))
    avatar_url: Mapped[str | None] = mapped_column(Text)
    is_email_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_phone_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    # Set when an admin blocks the account (is_active false); cleared on unblock.
    blocked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    blocked_reason: Mapped[str | None] = mapped_column(String(500))
    whatsapp_booking_updates: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    # Which side of the mobile app is showing (customer or artist; never admin). NULL until
    # Choose role, so "onboarded" is simply `active_role is not None`.
    active_role: Mapped[UserRole | None] = mapped_column(user_role_enum)

    # Every role the account holds; selectin because async sessions can't lazy-load.
    role_grants: Mapped[list["UserRoleGrant"]] = relationship(lazy="selectin", cascade="all, delete-orphan")

    __table_args__ = (sa.CheckConstraint("active_role <> 'admin'", name="active_role_not_admin"),)

    @property
    def roles(self) -> set[UserRole]:
        return {g.role for g in self.role_grants}

    @property
    def is_onboarded(self) -> bool:
        return self.active_role is not None

    def grant(self, role: UserRole) -> None:
        if role not in self.roles:
            self.role_grants.append(UserRoleGrant(role=role))


class UserRoleGrant(Base):
    """One role an account holds. A user can be customer, artist and admin at once."""

    __tablename__ = "user_role_grant"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("user_account.id", ondelete="CASCADE"), primary_key=True
    )
    role: Mapped[UserRole] = mapped_column(user_role_enum, primary_key=True)
    granted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class UserAddress(Base):
    """A labelled address the user saved to reuse in bookings and orders; most recently used first."""

    __tablename__ = "user_address"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("user_account.id", ondelete="CASCADE"), nullable=False, index=True
    )
    label: Mapped[str] = mapped_column(String(40), nullable=False)
    address: Mapped[str] = mapped_column(String(300), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
