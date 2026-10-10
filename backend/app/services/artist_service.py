"""The signed-in artist's own profile: build it step by step, then submit it for review.

Edits are allowed while the profile is a draft or was rejected; once submitted it is
locked until an admin decides (editing an approved profile is a later feature).
"""

import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.models.artist import ArtistProfile, ArtistServiceItem, PortfolioPhoto
from app.models.category import Category
from app.models.user import User
from app.schemas.artist import PhotoIn, ProfileIn, ServiceIn, ServicePatch
from app.services.storage import ImageStorage
from app.utils.enums import ArtistStatus

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

    async def _categories(self, ids: list[int]) -> list[Category]:
        wanted = set(ids)
        found = (await self.session.scalars(
            select(Category).where(Category.id.in_(wanted), Category.is_active.is_(True))
        )).all()
        if len(found) != len(wanted):
            raise ValidationError("Unknown category")
        return sorted(found, key=lambda c: c.sort_order)

    async def save_profile(self, user: User, body: ProfileIn) -> ArtistProfile:
        if body.city not in get_settings().cities:
            raise ValidationError("Unknown city")
        if body.photo_key and not self.storage.owns(body.photo_key, user.id, "artist_photo"):
            raise ValidationError("Invalid photo key")
        categories = await self._categories(body.category_ids)

        profile = await self.session.scalar(select(ArtistProfile).where(ArtistProfile.user_id == user.id))
        if profile is None:
            # Empty collections up front: a new object has nothing loaded, and async can't lazy-load later.
            profile = ArtistProfile(user_id=user.id, business_name=body.business_name, city=body.city, services=[], photos=[])
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

    async def add_service(self, user: User, body: ServiceIn) -> ArtistProfile:
        profile = await self._editable(user)
        await self._categories([body.category_id])
        profile.services.append(ArtistServiceItem(
            category_id=body.category_id,
            name=body.name.strip(),
            price_paise=body.price_paise,
            duration_minutes=body.duration_minutes,
            description=body.description,
            sort_order=max((s.sort_order for s in profile.services), default=-1) + 1,
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
        if changes.get("category_id") is not None:
            await self._categories([changes["category_id"]])
        for field in ("category_id", "name", "price_paise", "duration_minutes"):
            if changes.get(field) is not None:  # required columns: an explicit null means "leave as is"
                setattr(item, field, changes[field].strip() if field == "name" else changes[field])
        if "description" in changes:
            item.description = changes["description"]
        await self.session.flush()
        return profile

    async def delete_service(self, user: User, service_id: uuid.UUID) -> ArtistProfile:
        profile = await self._editable(user)
        profile.services.remove(self._service(profile, service_id))
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
        if missing:
            raise ValidationError("Profile is incomplete", missing=missing, min_photos=MIN_PHOTOS)
        profile.status = ArtistStatus.pending
        profile.submitted_at = datetime.now(UTC)
        profile.rejection_reason = None
        await self.session.flush()
        return profile
