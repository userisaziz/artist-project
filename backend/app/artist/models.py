"""An artist's onboarding profile: its categories, services, portfolio and KYC, plus the Aadhaar reveal audit (migration #3)."""

import uuid
from datetime import date, datetime

import sqlalchemy as sa
from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    SmallInteger,
    String,
    Table,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.catalog.models import Category, ServiceTemplate
from app.shared.enums import ArtistServiceStatus, ArtistStatus
from app.shared.models import Base, TimestampMixin
from app.subcategory_request.models import SubcategoryRequest

artist_categories = Table(
    "artist_category",
    Base.metadata,
    Column("artist_id", UUID(as_uuid=True), ForeignKey("artist_profile.id", ondelete="CASCADE"), primary_key=True),
    Column("category_id", Integer, ForeignKey("catalog_category.id"), primary_key=True),
)


class ArtistProfile(Base, TimestampMixin):
    __tablename__ = "artist_profile"
    # Fetch server defaults (status, timestamps) via RETURNING: async sessions can't lazy-load them after flush.
    __mapper_args__ = {"eager_defaults": True}

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("user_account.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    business_name: Mapped[str] = mapped_column(String(120), nullable=False)
    city: Mapped[str] = mapped_column(String(60), nullable=False)
    locality: Mapped[str | None] = mapped_column(String(80))  # the area clients see, e.g. "Koramangala"
    pincode: Mapped[str | None] = mapped_column(String(6))
    address_line: Mapped[str | None] = mapped_column(String(120))  # studio / house no.; never public
    # The pin from the Location step's "Use my current location"; only distances are ever public, never the point.
    latitude: Mapped[float | None] = mapped_column(sa.Float)
    longitude: Mapped[float | None] = mapped_column(sa.Float)
    bio: Mapped[str | None] = mapped_column(Text)
    # Provider-neutral storage key (never a full URL), so storage can move off Cloudinary later.
    photo_key: Mapped[str | None] = mapped_column(String(255))
    status: Mapped[ArtistStatus] = mapped_column(
        Enum(ArtistStatus, name="artist_status", values_callable=lambda e: [m.value for m in e]),
        default=ArtistStatus.draft,
        server_default=sa.text("'draft'"),
        nullable=False,
    )
    rejection_reason: Mapped[str | None] = mapped_column(String(500))
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("user_account.id"))
    travel_radius_km: Mapped[int | None] = mapped_column(SmallInteger)  # display only, never filters

    # selectin: async sessions can't lazy-load, and every read of a profile needs all three.
    categories: Mapped[list[Category]] = relationship(
        secondary=artist_categories, lazy="selectin", order_by=Category.sort_order
    )
    services: Mapped[list["ArtistServiceItem"]] = relationship(
        lazy="selectin", order_by="ArtistServiceItem.sort_order", cascade="all, delete-orphan"
    )
    photos: Mapped[list["PortfolioPhoto"]] = relationship(
        lazy="selectin", order_by="PortfolioPhoto.sort_order", cascade="all, delete-orphan"
    )
    kyc: Mapped["ArtistKyc | None"] = relationship(lazy="selectin", uselist=False, cascade="all, delete-orphan")

    __table_args__ = (
        sa.Index("ix_artist_profile_status_submitted", "status", "submitted_at", "id"),
        # Directory search is ILIKE '%q%': trigram indexes keep it off sequential scans.
        sa.Index(
            "ix_artist_profile_business_name_trgm",
            "business_name",
            postgresql_using="gin",
            postgresql_ops={"business_name": "gin_trgm_ops"},
        ),
        sa.CheckConstraint("travel_radius_km BETWEEN 1 AND 100", name="travel_radius_km_range"),
    )


class ArtistServiceItem(Base, TimestampMixin):
    """A bookable service on an artist's menu (named *Item* so it never clashes with service-layer classes)."""

    __tablename__ = "artist_service_item"
    # Fetch server defaults (status, timestamps) via RETURNING: async sessions can't lazy-load them after flush.
    __mapper_args__ = {"eager_defaults": True}

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
    )
    artist_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("artist_profile.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Template rows: the template's subcategory. Custom rows: the chosen subcategory. Pre-#6 rows: a top-level category.
    category_id: Mapped[int] = mapped_column(Integer, ForeignKey("catalog_category.id"), nullable=False)
    template_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("catalog_service_template.id"), index=True)
    name: Mapped[str | None] = mapped_column(String(120))  # NULL for template rows: the template's name is used
    price_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    # "What's included" lines, in the artist's order.
    included_items: Mapped[list[str]] = mapped_column(
        ARRAY(String(60)), nullable=False, default=list, server_default=sa.text("'{}'")
    )
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    status: Mapped[ArtistServiceStatus] = mapped_column(
        Enum(ArtistServiceStatus, name="artist_service_status", values_callable=lambda e: [m.value for m in e]),
        default=ArtistServiceStatus.approved,
        server_default=sa.text("'approved'"),
        nullable=False,
    )
    rejection_reason: Mapped[str | None] = mapped_column(String(500))
    # A custom service filed under a subcategory the artist suggested: it sits under the parent until approved.
    suggestion_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("subcategory_request.id", ondelete="SET NULL"), index=True
    )
    template: Mapped[ServiceTemplate | None] = relationship(lazy="selectin")
    subcategory_request: Mapped[SubcategoryRequest | None] = relationship(lazy="selectin")
    addons: Mapped[list["ArtistServiceAddon"]] = relationship(
        lazy="selectin", order_by="ArtistServiceAddon.sort_order", cascade="all, delete-orphan"
    )

    __table_args__ = (
        sa.CheckConstraint("price_paise > 0", name="price_positive"),
        sa.CheckConstraint("duration_minutes > 0", name="duration_positive"),
        sa.CheckConstraint("template_id IS NOT NULL OR name IS NOT NULL", name="name_or_template"),
        sa.Index(
            "ix_artist_service_item_name_trgm", "name", postgresql_using="gin", postgresql_ops={"name": "gin_trgm_ops"}
        ),
    )

    @property
    def display_name(self) -> str:
        """Template rows follow the admin's current name; custom rows keep their own."""
        # ck_artist_service_item_name_or_template guarantees a name when there is no template.
        return self.template.name if self.template else (self.name or "")


class ArtistServiceAddon(Base):
    """A priced extra on one service ("Guest mehendi +₹500 / person"); bookings copy it, so edits never reprice them."""

    __tablename__ = "artist_service_addon"
    __mapper_args__ = {"eager_defaults": True}

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
    )
    service_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("artist_service_item.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    price_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    per_person: Mapped[bool] = mapped_column(Boolean, default=False, server_default=sa.false(), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    __table_args__ = (sa.CheckConstraint("price_paise > 0", name="price_positive"),)


class PortfolioPhoto(Base):
    __tablename__ = "artist_portfolio_photo"
    # Fetch server defaults (status, timestamps) via RETURNING: async sessions can't lazy-load them after flush.
    __mapper_args__ = {"eager_defaults": True}

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
    )
    artist_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("artist_profile.id", ondelete="CASCADE"), nullable=False, index=True
    )
    storage_key: Mapped[str] = mapped_column(String(255), nullable=False)
    width: Mapped[int] = mapped_column(Integer, nullable=False)
    height: Mapped[int] = mapped_column(Integer, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)  # lowest = cover
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ArtistKyc(Base, TimestampMixin):
    """Identity proof for one artist profile. The Aadhaar number is Fernet-encrypted; only the last 4 are plain."""

    __tablename__ = "artist_kyc"
    __mapper_args__ = {"eager_defaults": True}

    artist_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("artist_profile.id", ondelete="CASCADE"), primary_key=True
    )
    aadhaar_encrypted: Mapped[str] = mapped_column(Text, nullable=False)
    aadhaar_last4: Mapped[str] = mapped_column(String(4), nullable=False)
    front_key: Mapped[str] = mapped_column(String(255), nullable=False)  # private storage keys
    back_key: Mapped[str] = mapped_column(String(255), nullable=False)


class AadhaarReveal(Base):
    """Audit trail: which admin decrypted which artist's Aadhaar number, and when."""

    __tablename__ = "artist_aadhaar_reveal"
    __mapper_args__ = {"eager_defaults": True}

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
    )
    artist_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("artist_profile.id", ondelete="CASCADE"), nullable=False, index=True
    )
    admin_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("user_account.id"), nullable=False)
    revealed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ArtistWorkingHour(Base):
    """One weekday of an artist's week. A weekday without a row uses the default hours (see constants.py)."""

    __tablename__ = "artist_working_hour"

    artist_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("artist_profile.id", ondelete="CASCADE"), primary_key=True
    )
    weekday: Mapped[int] = mapped_column(SmallInteger, primary_key=True)  # 0 = Monday
    is_open: Mapped[bool] = mapped_column(Boolean, nullable=False)
    open_hour: Mapped[int] = mapped_column(SmallInteger, nullable=False)  # closed days keep their hours too
    close_hour: Mapped[int] = mapped_column(SmallInteger, nullable=False)

    __table_args__ = (
        sa.CheckConstraint("weekday BETWEEN 0 AND 6", name="weekday_range"),
        sa.CheckConstraint("0 <= open_hour AND open_hour < close_hour AND close_hour <= 24", name="hours_range"),
    )


class ArtistDayOff(Base):
    """A date the artist takes no new bookings. Bookings already made for it stay as they are."""

    __tablename__ = "artist_day_off"

    artist_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("artist_profile.id", ondelete="CASCADE"), primary_key=True
    )
    day_date: Mapped[date] = mapped_column(Date, primary_key=True)
