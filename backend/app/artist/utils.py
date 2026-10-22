"""Pure mappers from artist models to response-shaped dicts; image keys become URLs through `ImageStorage`.

Plain dicts, not schema instances: the route's response_model validates and serialises them once.
"""

from app.artist.aadhaar import mask_aadhaar_last4
from app.artist.models import (
    ArtistKyc,
    ArtistProfile,
    ArtistServiceItem,
    PortfolioPhoto,
)
from app.artist.repository import CustomServiceRow
from app.upload.service import ImageStorage
from app.user.models import User


def addons_out(item: ArtistServiceItem) -> list[dict]:
    return [dict(id=a.id, name=a.name, price_paise=a.price_paise, per_person=a.per_person) for a in item.addons]


def service_out(item: ArtistServiceItem) -> dict:
    return dict(
        id=item.id,
        category_id=item.category_id,
        subcategory_id=item.category_id,
        template_id=item.template_id,
        name=item.display_name,
        price_paise=item.price_paise,
        duration_minutes=item.duration_minutes,
        description=item.description,
        included_items=list(item.included_items),
        addons=addons_out(item),
        status=item.status,
        rejection_reason=item.rejection_reason,
        suggested_subcategory=(
            dict(id=r.id, name=r.name, status=r.status) if (r := item.subcategory_request) is not None else None
        ),
    )


def photo_out(photo: PortfolioPhoto, storage: ImageStorage) -> dict:
    key = photo.storage_key
    return dict(
        id=photo.id,
        key=key,
        width=photo.width,
        height=photo.height,
        thumb_url=storage.url(key, "thumb"),
        card_url=storage.url(key, "card"),
        full_url=storage.url(key, "full"),
    )


def profile_out(profile: ArtistProfile, storage: ImageStorage) -> dict:
    return dict(
        id=profile.id,
        status=profile.status,
        business_name=profile.business_name,
        city=profile.city,
        locality=profile.locality,
        pincode=profile.pincode,
        address_line=profile.address_line,
        latitude=profile.latitude,
        longitude=profile.longitude,
        bio=profile.bio,
        photo_key=profile.photo_key,
        photo_url=storage.url(profile.photo_key, "thumb") if profile.photo_key else None,
        categories=list(profile.categories),
        services=[service_out(s) for s in profile.services],
        photos=[photo_out(p, storage) for p in profile.photos],
        kyc={"aadhaar_last4": profile.kyc.aadhaar_last4} if profile.kyc else None,
        rejection_reason=profile.rejection_reason,
        submitted_at=profile.submitted_at,
        reviewed_at=profile.reviewed_at,
    )


def summary_out(profile: ArtistProfile, storage: ImageStorage) -> dict:
    return dict(
        id=profile.id,
        status=profile.status,
        business_name=profile.business_name,
        city=profile.city,
        photo_url=storage.url(profile.photo_key, "thumb") if profile.photo_key else None,
        categories=[c.name for c in profile.categories],
        service_count=len(profile.services),
        photo_count=len(profile.photos),
        submitted_at=profile.submitted_at,
        reviewed_at=profile.reviewed_at,
    )


def admin_kyc_out(kyc: ArtistKyc | None, storage: ImageStorage) -> dict | None:
    if kyc is None:
        return None
    return dict(
        aadhaar_masked=mask_aadhaar_last4(kyc.aadhaar_last4),
        front_url=storage.private_url(kyc.front_key),
        back_url=storage.private_url(kyc.back_key),
    )


def admin_detail_out(profile: ArtistProfile, owner: User, storage: ImageStorage) -> dict:
    return {**profile_out(profile, storage), "owner": owner, "kyc": admin_kyc_out(profile.kyc, storage)}


def custom_service_out(row: CustomServiceRow) -> dict:
    item, business_name, subcategory, parent = row
    return dict(
        id=item.id,
        artist_id=item.artist_id,
        business_name=business_name,
        category={"id": parent.id, "name": parent.name} if parent else None,
        subcategory={"id": subcategory.id, "name": subcategory.name},
        name=item.name,
        price_paise=item.price_paise,
        duration_minutes=item.duration_minutes,
        description=item.description,
        included_items=list(item.included_items),
        addons=addons_out(item),
        status=item.status,
        rejection_reason=item.rejection_reason,
        created_at=item.created_at,
    )
