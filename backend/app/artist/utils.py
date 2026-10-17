"""Pure mappers from artist models to response schemas; image keys become URLs through `ImageStorage`."""

from app.artist.aadhaar import mask_aadhaar_last4
from app.artist.models import (
    ArtistKyc,
    ArtistProfile,
    ArtistServiceItem,
    PortfolioPhoto,
)
from app.artist.repository import CustomServiceRow
from app.artist.schemas import (
    AdminArtistDetail,
    AdminArtistSummary,
    AdminCustomServiceOut,
    AdminKycOut,
    ArtistOwner,
    ArtistProfileOut,
    CategoryOut,
    KycOut,
    NamedRef,
    PhotoOut,
    ServiceOut,
)
from app.services.upload.storage import ImageStorage
from app.user.models import User


def service_out(item: ArtistServiceItem) -> ServiceOut:
    return ServiceOut(
        id=item.id, category_id=item.category_id, subcategory_id=item.category_id, template_id=item.template_id,
        name=item.display_name, price_paise=item.price_paise, duration_minutes=item.duration_minutes,
        description=item.description, status=item.status, rejection_reason=item.rejection_reason,
    )


def photo_out(photo: PortfolioPhoto, storage: ImageStorage) -> PhotoOut:
    key = photo.storage_key
    return PhotoOut(
        id=photo.id, key=key, width=photo.width, height=photo.height,
        thumb_url=storage.url(key, "thumb"), card_url=storage.url(key, "card"), full_url=storage.url(key, "full"),
    )


def profile_out(profile: ArtistProfile, storage: ImageStorage) -> ArtistProfileOut:
    return ArtistProfileOut(
        id=profile.id,
        status=profile.status,
        business_name=profile.business_name,
        city=profile.city,
        bio=profile.bio,
        photo_key=profile.photo_key,
        photo_url=storage.url(profile.photo_key, "thumb") if profile.photo_key else None,
        categories=[CategoryOut.model_validate(c) for c in profile.categories],
        services=[service_out(s) for s in profile.services],
        photos=[photo_out(p, storage) for p in profile.photos],
        kyc=KycOut(aadhaar_last4=profile.kyc.aadhaar_last4) if profile.kyc else None,
        rejection_reason=profile.rejection_reason,
        submitted_at=profile.submitted_at,
        reviewed_at=profile.reviewed_at,
    )


def summary_out(profile: ArtistProfile, storage: ImageStorage) -> AdminArtistSummary:
    return AdminArtistSummary(
        id=profile.id,
        status=profile.status,
        business_name=profile.business_name,
        city=profile.city,
        photo_url=storage.url(profile.photo_key, "thumb") if profile.photo_key else None,
        categories=[c.name for c in profile.categories],
        service_count=len(profile.services),
        photo_count=len(profile.photos),
        submitted_at=profile.submitted_at,
    )


def admin_kyc_out(kyc: ArtistKyc | None, storage: ImageStorage) -> AdminKycOut | None:
    if kyc is None:
        return None
    return AdminKycOut(
        aadhaar_masked=mask_aadhaar_last4(kyc.aadhaar_last4),
        front_url=storage.private_url(kyc.front_key),
        back_url=storage.private_url(kyc.back_key),
    )


def admin_detail_out(profile: ArtistProfile, owner: User, storage: ImageStorage) -> AdminArtistDetail:
    data = profile_out(profile, storage).model_dump(exclude={"kyc"})
    return AdminArtistDetail(**data, owner=ArtistOwner.model_validate(owner), kyc=admin_kyc_out(profile.kyc, storage))


def custom_service_out(row: CustomServiceRow) -> AdminCustomServiceOut:
    item, business_name, subcategory, parent = row
    return AdminCustomServiceOut(
        id=item.id, artist_id=item.artist_id, business_name=business_name,
        category=NamedRef(id=parent.id, name=parent.name) if parent else None,
        subcategory=NamedRef(id=subcategory.id, name=subcategory.name),
        name=item.name, price_paise=item.price_paise, duration_minutes=item.duration_minutes,
        description=item.description, status=item.status, rejection_reason=item.rejection_reason,
        created_at=item.created_at,
    )
