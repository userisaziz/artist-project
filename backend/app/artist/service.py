"""The signed-in artist's own profile: build it step by step, then submit it for review.

Edits are allowed while the profile is a draft or was rejected; once submitted it is
locked until an admin decides (editing an approved profile is a later feature). Approved
artists can propose custom services, which wait for admin review one by one.
"""

import uuid
from collections.abc import Sequence
from dataclasses import dataclass
from typing import cast

from sqlalchemy.ext.asyncio import AsyncSession

from app.artist.aadhaar import is_valid_aadhaar
from app.artist.models import (
    ArtistKyc,
    ArtistProfile,
    ArtistServiceAddon,
    ArtistServiceItem,
    PortfolioPhoto,
)
from app.artist.repository import ArtistRepository
from app.artist.schemas import (
    CustomServiceIn,
    CustomServicePatch,
    KycIn,
    LocationIn,
    PhotoIn,
    ProfileIn,
    ServiceIn,
    ServicePatch,
)
from app.catalog.config import get_catalog_settings
from app.catalog.models import Area, Category, ServiceTemplate
from app.catalog.repository import CategoryRepository, TemplateRepository
from app.core.crypto import encrypt_aadhaar
from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.notification import service as notification_service
from app.shared.clock import Clock
from app.shared.enums import ArtistServiceStatus, ArtistStatus, CategoryStatus
from app.subcategory_request import service as subcategory_request_service
from app.upload.service import ImageStorage
from app.user.models import User

MIN_PHOTOS = 6
MAX_PHOTOS = 30
EDITABLE = {ArtistStatus.draft, ArtistStatus.rejected}
DELETED_NAME = "Deleted artist"


@dataclass(frozen=True)
class ErasedArtist:
    """What `erase` left behind: the profile id (kept for history) and the image keys to remove from storage."""

    artist_id: uuid.UUID
    public_keys: list[str]
    private_keys: list[str]


class ArtistService:
    def __init__(self, session: AsyncSession, storage: ImageStorage, clock: Clock):
        self.session = session
        self.storage = storage
        self.clock = clock
        self.artists = ArtistRepository(session)
        self.categories = CategoryRepository(session)
        self.templates = TemplateRepository(session)

    async def get(self, user: User) -> ArtistProfile:
        profile = await self.artists.by_user(user.id)
        if profile is None:
            raise NotFoundError("No artist profile yet")
        return profile

    async def erase(self, user: User) -> ErasedArtist | None:
        """Account deletion: the profile stays (bookings, orders and reviews point at it) but is suspended, so it
        leaves the directory and can't be booked; its name, bio, photos and KYC go. Services stay for history.
        Storage is not touched here: the caller removes the returned keys once the deletion is committed."""
        profile = await self.artists.by_user(user.id)
        if profile is None:
            return None
        public = (
            ([profile.photo_key] if profile.photo_key else [])
            + [p.storage_key for p in profile.photos]
            + [s.photo_key for s in profile.services if s.photo_key]
        )
        private = [profile.kyc.front_key, profile.kyc.back_key] if profile.kyc else []
        profile.status = ArtistStatus.suspended
        profile.business_name = DELETED_NAME
        profile.bio = None
        profile.photo_key = None
        profile.photos.clear()
        for s in profile.services:
            s.photo_key = None
        profile.kyc = None
        await self.session.flush()
        return ErasedArtist(artist_id=profile.id, public_keys=public, private_keys=private)

    async def _editable(self, user: User) -> ArtistProfile:
        profile = await self.get(user)
        if profile.status not in EDITABLE:
            raise ConflictError(f"Profile is {profile.status.value} and can't be edited")
        return profile

    async def _categories(self, ids: list[int], current: Sequence[Category] = ()) -> list[Category]:
        """Top-level categories an artist may pick: active ones, plus inactive ones the profile already has."""
        wanted = set(ids)
        kept = {c.id for c in current}
        found = await self.categories.top_level_by_ids(wanted)
        allowed = [
            c
            for c in found
            if c.status == CategoryStatus.active or (c.status == CategoryStatus.inactive and c.id in kept)
        ]
        if len(allowed) != len(wanted):
            raise ValidationError("Unknown category")
        return sorted(allowed, key=lambda c: c.sort_order)

    async def save_profile(self, user: User, body: ProfileIn) -> ArtistProfile:
        if body.city not in get_catalog_settings().cities:
            raise ValidationError("Unknown city")
        if body.photo_key and not self.storage.owns(body.photo_key, user.id, "artist_photo"):
            raise ValidationError("Invalid photo key")
        profile = await self.artists.by_user(user.id)
        categories = await self._categories(body.category_ids, profile.categories if profile else [])
        if profile is None:
            # Empty collections up front: a new object has nothing loaded, and async can't lazy-load later.
            profile = ArtistProfile(
                user_id=user.id, business_name=body.business_name, city=body.city, services=[], photos=[], kyc=None
            )
            self.artists.add(profile)
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

    async def save_location(self, user: User, body: LocationIn) -> ArtistProfile:
        """Editable while onboarding and, without a new review, once approved (a profile requirement may ask for it)."""
        profile = await self.get(user)
        if profile.status not in EDITABLE | {ArtistStatus.approved}:
            raise ConflictError(f"Profile is {profile.status.value} and can't be edited")
        area = await self.session.get(Area, body.area_id)
        if area is None or not area.is_active:
            raise ValidationError("Unknown area")
        profile.area_id = area.id
        profile.locality = area.name
        profile.city = area.city  # the area decides the city, so the two can't disagree
        profile.pincode = body.pincode
        profile.address_line = body.address_line or None
        profile.latitude = body.latitude
        profile.longitude = body.longitude
        await self.session.flush()
        return profile

    def _next_service_order(self, profile: ArtistProfile) -> int:
        return max((s.sort_order for s in profile.services), default=-1) + 1

    async def _template(self, profile: ArtistProfile, template_id: int) -> ServiceTemplate:
        """An active service from the admin's list, under one of the artist's chosen categories."""
        template = await self.templates.get(template_id)
        subcategory = await self.categories.get(template.subcategory_id) if template else None
        parent = await self.categories.get(subcategory.parent_id) if subcategory and subcategory.parent_id else None
        if not (
            template
            and template.is_active
            and subcategory is not None
            and subcategory.status == CategoryStatus.active
            and parent
            and parent.status == CategoryStatus.active
        ):
            raise ValidationError("Unknown service")
        if parent.id not in {c.id for c in profile.categories}:
            raise ValidationError("Pick that category on your profile first")
        return template

    @staticmethod
    def _apply_extras(item: ArtistServiceItem, changes: dict) -> None:
        """Included items and add-ons: a list that is given replaces the old one; None leaves it as it is."""
        if changes.get("included_items") is not None:
            item.included_items = list(changes["included_items"])
        if changes.get("addons") is not None:
            item.addons = [
                # An edit's exclude_unset dump drops a per_person left at its default.
                ArtistServiceAddon(
                    name=a["name"], price_paise=a["price_paise"], per_person=a.get("per_person", False), sort_order=i
                )
                for i, a in enumerate(changes["addons"])
            ]

    def _apply_photo(self, user: User, item: ArtistServiceItem, changes: dict) -> str | None:
        """A sent `photo_key` replaces the package photo (null removes it); it must be the artist's own "service"
        upload. Returns the replaced file's key, for the caller to delete once the change is flushed."""
        if "photo_key" not in changes:
            return None
        new = changes["photo_key"]
        if new and not self.storage.owns(new, user.id, "service"):
            raise ValidationError("Invalid photo key")
        old, item.photo_key = item.photo_key, new
        return old if old and old != new else None

    async def add_service(self, user: User, body: ServiceIn) -> ArtistProfile:
        profile = await self._editable(user)
        template = await self._template(profile, body.template_id)
        if any(s.template_id == template.id for s in profile.services):
            raise ConflictError("You've already added this service")
        item = ArtistServiceItem(
            template=template,
            category_id=template.subcategory_id,
            price_paise=body.price_paise,
            duration_minutes=body.duration_minutes,
            description=body.description,
            status=ArtistServiceStatus.approved,
            sort_order=self._next_service_order(profile),
            addons=[],  # set, so reading it after flush never lazy-loads (async)
        )
        self._apply_extras(item, body.model_dump(include={"included_items", "addons"}))
        self._apply_photo(user, item, body.model_dump(include={"photo_key"}, exclude_none=True))
        profile.services.append(item)
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
        self._apply_extras(item, changes)
        replaced = self._apply_photo(user, item, changes)
        await self.session.flush()
        if replaced:
            await self.storage.delete(replaced)
        return profile

    async def delete_service(self, user: User, service_id: uuid.UUID) -> ArtistProfile:
        profile = await self._editable(user)
        item = self._service(profile, service_id)
        photo = item.photo_key
        profile.services.remove(item)
        await self.session.flush()
        if photo:
            await self.storage.delete(photo)
        return profile

    async def _approved(self, user: User) -> ArtistProfile:
        profile = await self.get(user)
        if profile.status != ArtistStatus.approved:
            raise ConflictError("Custom services open once your profile is approved")
        return profile

    async def _subcategory(self, subcategory_id: int) -> Category:
        subcategory = await self.categories.get(subcategory_id)
        parent = await self.categories.get(subcategory.parent_id) if subcategory and subcategory.parent_id else None
        if not (
            subcategory
            and subcategory.status == CategoryStatus.active
            and parent
            and parent.status == CategoryStatus.active
        ):
            raise ValidationError("Unknown subcategory")
        return subcategory

    def _custom(self, profile: ArtistProfile, service_id: uuid.UUID) -> ArtistServiceItem:
        item = self._service(profile, service_id)
        if item.template_id is not None:
            raise NotFoundError("Service not found")
        return item

    async def add_custom_service(self, user: User, body: CustomServiceIn) -> ArtistProfile:
        """Under an active subcategory, or under the artist's own suggestion (filed under its parent until an
        admin decides on it; see app.subcategory_request)."""
        profile = await self._approved(user)
        name = body.name.strip()
        if not name:
            raise ValidationError("Name is required")
        suggestion = None
        if body.suggested_subcategory is not None:
            requests = subcategory_request_service.SubcategoryRequestService(self.session, self.clock)
            suggestion = await requests.suggest(profile.id, body.suggested_subcategory)
            place = suggestion.parent_id
        else:
            place = (await self._subcategory(cast(int, body.subcategory_id))).id
        item = ArtistServiceItem(
            category_id=place,
            subcategory_request=suggestion,
            name=name,
            price_paise=body.price_paise,
            duration_minutes=body.duration_minutes,
            description=body.description,
            status=ArtistServiceStatus.pending,
            sort_order=self._next_service_order(profile),
            addons=[],
        )
        self._apply_extras(item, body.model_dump(include={"included_items", "addons"}))
        self._apply_photo(user, item, body.model_dump(include={"photo_key"}, exclude_none=True))
        profile.services.append(item)
        await self.session.flush()
        return profile

    async def update_custom_service(self, user: User, service_id: uuid.UUID, body: CustomServicePatch) -> ArtistProfile:
        """Any edit sends the service back for review."""
        profile = await self._approved(user)
        item = self._custom(profile, service_id)
        changes = body.model_dump(exclude_unset=True)
        left = None
        if changes.get("subcategory_id") is not None:
            await self._subcategory(changes["subcategory_id"])
            item.category_id = changes["subcategory_id"]
            left, item.subcategory_request = item.suggestion_id, None  # moved off its suggestion
        if changes.get("name") is not None:
            changes["name"] = changes["name"].strip()
            if not changes["name"]:
                raise ValidationError("Name is required")
        for field in ("name", "price_paise", "duration_minutes"):
            if changes.get(field) is not None:
                setattr(item, field, changes[field])
        if "description" in changes:
            item.description = changes["description"]
        self._apply_extras(item, changes)
        replaced = self._apply_photo(user, item, changes)
        item.status = ArtistServiceStatus.pending
        item.rejection_reason = None
        await self.session.flush()
        if replaced:
            await self.storage.delete(replaced)
        if left is not None:
            await subcategory_request_service.SubcategoryRequestService(self.session, self.clock).withdraw_if_unused(
                left
            )
        return profile

    async def delete_custom_service(self, user: User, service_id: uuid.UUID) -> ArtistProfile:
        profile = await self._approved(user)
        item = self._custom(profile, service_id)
        left, photo = item.suggestion_id, item.photo_key
        profile.services.remove(item)
        await self.session.flush()
        if photo:
            await self.storage.delete(photo)
        if left is not None:
            await subcategory_request_service.SubcategoryRequestService(self.session, self.clock).withdraw_if_unused(
                left
            )
        return profile

    async def add_photo(self, user: User, body: PhotoIn) -> ArtistProfile:
        profile = await self._editable(user)
        if not self.storage.owns(body.key, user.id, "portfolio"):
            raise ValidationError("Invalid photo key")
        if any(p.storage_key == body.key for p in profile.photos):
            raise ConflictError("Photo already added")
        if len(profile.photos) >= MAX_PHOTOS:
            raise ValidationError(f"A portfolio holds at most {MAX_PHOTOS} photos")
        profile.photos.append(
            PortfolioPhoto(
                storage_key=body.key,
                width=body.width,
                height=body.height,
                sort_order=max((p.sort_order for p in profile.photos), default=-1) + 1,
            )
        )
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

        fields = {
            "aadhaar_encrypted": encrypt_aadhaar(number),
            "aadhaar_last4": number[-4:],
            "front_key": body.front_key,
            "back_key": body.back_key,
        }
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

    async def reopen(self, user: User) -> ArtistProfile:
        """An approved artist edits again: back to draft, so they leave the directory until an admin re-approves."""
        profile = await self.get(user)
        if profile.status != ArtistStatus.approved:
            raise ConflictError(f"Profile is {profile.status.value}; only an approved profile can be reopened")
        profile.status = ArtistStatus.draft
        await self.session.flush()
        return profile

    async def submit(self, user: User) -> ArtistProfile:
        profile = await self._editable(user)
        missing = []
        if not profile.photo_key:
            missing.append("photo")
        if not profile.categories:
            missing.append("categories")
        if profile.area_id is None or not profile.pincode:
            missing.append("location")
        if not profile.services:
            missing.append("services")
        if len(profile.photos) < MIN_PHOTOS:
            missing.append("portfolio")
        if profile.kyc is None:
            missing.append("kyc")
        if missing:
            raise ValidationError("Profile is incomplete", missing=missing, min_photos=MIN_PHOTOS)
        profile.status = ArtistStatus.pending
        profile.submitted_at = self.clock.now()
        profile.rejection_reason = None
        await self.session.flush()
        title = "Artist edited their profile" if profile.reviewed_at else "New artist to review"
        await notification_service.notify_admins(
            self.session,
            "artist_submitted",
            title,
            f"{profile.business_name}, {profile.city}",
            f"/artists/{profile.id}",
        )
        return profile
