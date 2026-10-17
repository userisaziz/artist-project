"""The signed-in artist's own profile: build it step by step, then submit it for review.

Edits are allowed while the profile is a draft or was rejected; once submitted it is
locked until an admin decides (editing an approved profile is a later feature). Approved
artists can propose custom services, which wait for admin review one by one.
"""

import uuid
from datetime import UTC, datetime

from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.crypto import encrypt_aadhaar
from app.core.database import get_db
from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.models.artist import (
    ArtistKyc,
    ArtistProfile,
    ArtistServiceItem,
    PortfolioPhoto,
)
from app.models.category import Category
from app.models.service_template import ServiceTemplate
from app.modules.uploads.storage import ImageStorage, get_storage
from app.modules.users.models import User
from app.schemas.artist import (
    CustomServiceIn,
    CustomServicePatch,
    KycIn,
    PhotoIn,
    ProfileIn,
    ServiceIn,
    ServicePatch,
)
from app.shared.enums import ArtistServiceStatus, ArtistStatus, CategoryStatus
from app.utils.aadhaar import is_valid_aadhaar

MIN_PHOTOS = 6
MAX_PHOTOS = 30
EDITABLE = {ArtistStatus.draft, ArtistStatus.rejected}


class ArtistService:
    def __init__(self, session: AsyncSession, storage: ImageStorage):
        self.session = session
        self.storage = storage

    async def get(self, user: User) -> ArtistProfile:
        profile = await self.session.scalar(select(ArtistProfile).where(ArtistProfile.user_id == user.id))
        if profile is None:
            raise NotFoundError("No artist profile yet")
        return profile

    async def _editable(self, user: User) -> ArtistProfile:
        profile = await self.get(user)
        if profile.status not in EDITABLE:
            raise ConflictError(f"Profile is {profile.status.value} and can't be edited")
        return profile

    async def _categories(self, ids: list[int], current: list[Category] = ()) -> list[Category]:
        """Top-level categories an artist may pick: active ones, plus inactive ones the profile already has."""
        wanted = set(ids)
        kept = {c.id for c in current}
        found = (await self.session.scalars(
            select(Category).where(Category.id.in_(wanted), Category.parent_id.is_(None))
        )).all()
        allowed = [c for c in found
                   if c.status == CategoryStatus.active or (c.status == CategoryStatus.inactive and c.id in kept)]
        if len(allowed) != len(wanted):
            raise ValidationError("Unknown category")
        return sorted(allowed, key=lambda c: c.sort_order)

    async def save_profile(self, user: User, body: ProfileIn) -> ArtistProfile:
        if body.city not in get_settings().cities:
            raise ValidationError("Unknown city")
        if body.photo_key and not self.storage.owns(body.photo_key, user.id, "artist_photo"):
            raise ValidationError("Invalid photo key")
        profile = await self.session.scalar(select(ArtistProfile).where(ArtistProfile.user_id == user.id))
        categories = await self._categories(body.category_ids, profile.categories if profile else [])
        if profile is None:
            # Empty collections up front: a new object has nothing loaded, and async can't lazy-load later.
            profile = ArtistProfile(user_id=user.id, business_name=body.business_name, city=body.city, services=[], photos=[], kyc=None)
            self.session.add(profile)
        elif profile.status not in EDITABLE:
            raise ConflictError(f"Profile is {profile.status.value} and can't be edited")
        old_photo = profile.photo_key

        profile.business_name = body.business_name.strip()
        profile.city = body.city
        profile.bio = body.bio
        profile.photo_key = body.photo_key
        profile.categories = categories
        await self.session.flush()
        if old_photo and old_photo != body.photo_key:
            await self.storage.delete(old_photo)
        return profile

    def _next_service_order(self, profile: ArtistProfile) -> int:
        return max((s.sort_order for s in profile.services), default=-1) + 1

    async def _template(self, profile: ArtistProfile, template_id: int) -> ServiceTemplate:
        """An active service from the admin's list, under one of the artist's chosen categories."""
        template = await self.session.get(ServiceTemplate, template_id)
        subcategory = await self.session.get(Category, template.subcategory_id) if template else None
        parent = await self.session.get(Category, subcategory.parent_id) if subcategory and subcategory.parent_id else None
        if not (template and template.is_active and subcategory.status == CategoryStatus.active
                and parent and parent.status == CategoryStatus.active):
            raise ValidationError("Unknown service")
        if parent.id not in {c.id for c in profile.categories}:
            raise ValidationError("Pick that category on your profile first")
        return template

    async def add_service(self, user: User, body: ServiceIn) -> ArtistProfile:
        profile = await self._editable(user)
        template = await self._template(profile, body.template_id)
        if any(s.template_id == template.id for s in profile.services):
            raise ConflictError("You've already added this service")
        profile.services.append(ArtistServiceItem(
            template=template,
            category_id=template.subcategory_id,
            price_paise=body.price_paise,
            duration_minutes=body.duration_minutes,
            description=body.description,
            status=ArtistServiceStatus.approved,
            sort_order=self._next_service_order(profile),
        ))
        await self.session.flush()
        return profile

    def _service(self, profile: ArtistProfile, service_id: uuid.UUID) -> ArtistServiceItem:
        for item in profile.services:
            if item.id == service_id:
                return item
        raise NotFoundError("Service not found")

    async def update_service(self, user: User, service_id: uuid.UUID, body: ServicePatch) -> ArtistProfile:
        profile = await self._editable(user)
        item = self._service(profile, service_id)
        changes = body.model_dump(exclude_unset=True)
        for field in ("price_paise", "duration_minutes"):
            if changes.get(field) is not None:  # required columns: an explicit null means "leave as is"
                setattr(item, field, changes[field])
        if "description" in changes:
            item.description = changes["description"]
        await self.session.flush()
        return profile

    async def delete_service(self, user: User, service_id: uuid.UUID) -> ArtistProfile:
        profile = await self._editable(user)
        profile.services.remove(self._service(profile, service_id))
        await self.session.flush()
        return profile

    async def _approved(self, user: User) -> ArtistProfile:
        profile = await self.get(user)
        if profile.status != ArtistStatus.approved:
            raise ConflictError("Custom services open once your profile is approved")
        return profile

    async def _subcategory(self, subcategory_id: int) -> Category:
        subcategory = await self.session.get(Category, subcategory_id)
        parent = await self.session.get(Category, subcategory.parent_id) if subcategory and subcategory.parent_id else None
        if not (subcategory and subcategory.status == CategoryStatus.active and parent and parent.status == CategoryStatus.active):
            raise ValidationError("Unknown subcategory")
        return subcategory

    def _custom(self, profile: ArtistProfile, service_id: uuid.UUID) -> ArtistServiceItem:
        item = self._service(profile, service_id)
        if item.template_id is not None:
            raise NotFoundError("Service not found")
        return item

    async def add_custom_service(self, user: User, body: CustomServiceIn) -> ArtistProfile:
        profile = await self._approved(user)
        await self._subcategory(body.subcategory_id)
        name = body.name.strip()
        if not name:
            raise ValidationError("Name is required")
        profile.services.append(ArtistServiceItem(
            category_id=body.subcategory_id,
            name=name,
            price_paise=body.price_paise,
            duration_minutes=body.duration_minutes,
            description=body.description,
            status=ArtistServiceStatus.pending,
            sort_order=self._next_service_order(profile),
        ))
        await self.session.flush()
        return profile

    async def update_custom_service(self, user: User, service_id: uuid.UUID, body: CustomServicePatch) -> ArtistProfile:
        """Any edit sends the service back for review."""
        profile = await self._approved(user)
        item = self._custom(profile, service_id)
        changes = body.model_dump(exclude_unset=True)
        if changes.get("subcategory_id") is not None:
            await self._subcategory(changes["subcategory_id"])
            item.category_id = changes["subcategory_id"]
        if changes.get("name") is not None:
            changes["name"] = changes["name"].strip()
            if not changes["name"]:
                raise ValidationError("Name is required")
        for field in ("name", "price_paise", "duration_minutes"):
            if changes.get(field) is not None:
                setattr(item, field, changes[field])
        if "description" in changes:
            item.description = changes["description"]
        item.status = ArtistServiceStatus.pending
        item.rejection_reason = None
        await self.session.flush()
        return profile

    async def delete_custom_service(self, user: User, service_id: uuid.UUID) -> ArtistProfile:
        profile = await self._approved(user)
        profile.services.remove(self._custom(profile, service_id))
        await self.session.flush()
        return profile

    async def add_photo(self, user: User, body: PhotoIn) -> ArtistProfile:
        profile = await self._editable(user)
        if not self.storage.owns(body.key, user.id, "portfolio"):
            raise ValidationError("Invalid photo key")
        if any(p.storage_key == body.key for p in profile.photos):
            raise ConflictError("Photo already added")
        if len(profile.photos) >= MAX_PHOTOS:
            raise ValidationError(f"A portfolio holds at most {MAX_PHOTOS} photos")
        profile.photos.append(PortfolioPhoto(
            storage_key=body.key, width=body.width, height=body.height,
            sort_order=max((p.sort_order for p in profile.photos), default=-1) + 1,
        ))
        await self.session.flush()
        return profile

    async def delete_photo(self, user: User, photo_id: uuid.UUID) -> ArtistProfile:
        profile = await self._editable(user)
        photo = next((p for p in profile.photos if p.id == photo_id), None)
        if photo is None:
            raise NotFoundError("Photo not found")
        profile.photos.remove(photo)
        await self.session.flush()
        await self.storage.delete(photo.storage_key)
        return profile

    async def reorder_photos(self, user: User, photo_ids: list[uuid.UUID]) -> ArtistProfile:
        profile = await self._editable(user)
        by_id = {p.id: p for p in profile.photos}
        if len(photo_ids) != len(by_id) or set(photo_ids) != set(by_id):
            raise ValidationError("photo_ids must list every portfolio photo exactly once")
        for i, pid in enumerate(photo_ids):
            by_id[pid].sort_order = i
        profile.photos.sort(key=lambda p: p.sort_order)
        await self.session.flush()
        return profile

    async def save_kyc(self, user: User, body: KycIn) -> ArtistProfile:
        """Identity step: validate, encrypt, store; a replacement deletes the superseded private files."""
        profile = await self._editable(user)
        number = body.aadhaar_number.replace(" ", "")
        if not is_valid_aadhaar(number):
            raise ValidationError("Invalid Aadhaar number")
        for key in (body.front_key, body.back_key):
            if not self.storage.owns(key, user.id, "aadhaar"):
                raise ValidationError("Invalid photo key")
        if body.front_key == body.back_key:
            raise ValidationError("Front and back must be different photos")

        fields = {"aadhaar_encrypted": encrypt_aadhaar(number), "aadhaar_last4": number[-4:],
                  "front_key": body.front_key, "back_key": body.back_key}
        stale: list[str] = []
        if profile.kyc is None:
            profile.kyc = ArtistKyc(**fields)
        else:
            kept = {body.front_key, body.back_key}
            stale = [k for k in (profile.kyc.front_key, profile.kyc.back_key) if k not in kept]
            for name, value in fields.items():
                setattr(profile.kyc, name, value)
        await self.session.flush()
        for key in stale:
            await self.storage.delete(key, private=True)
        return profile

    async def submit(self, user: User) -> ArtistProfile:
        profile = await self._editable(user)
        missing = []
        if not profile.photo_key:
            missing.append("photo")
        if not profile.categories:
            missing.append("categories")
        if not profile.services:
            missing.append("services")
        if len(profile.photos) < MIN_PHOTOS:
            missing.append("portfolio")
        if profile.kyc is None:
            missing.append("kyc")
        if missing:
            raise ValidationError("Profile is incomplete", missing=missing, min_photos=MIN_PHOTOS)
        profile.status = ArtistStatus.pending
        profile.submitted_at = datetime.now(UTC)
        profile.rejection_reason = None
        await self.session.flush()
        return profile


def get_artist_service(
    session: AsyncSession = Depends(get_db), storage: ImageStorage = Depends(get_storage)
) -> ArtistService:
    return ArtistService(session, storage)
