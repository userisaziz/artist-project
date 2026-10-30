"""Seed demo data into the active database: `python -m scripts.seed` (from backend/).

Idempotent — every block checks for its own rows first (slugs / phones / user_id), so re-running
adds nothing. Seeds: catalog categories + subcategories + service templates, an admin, customers,
and artist profiles (approved + one pending) with services, addons and portfolio photos, plus avatar
and service photos; image assets are uploaded to R2 by `seed_images`.
"""

import asyncio
from pathlib import Path

from botocore.exceptions import ClientError
from sqlalchemy import select

from app.artist.models import ArtistProfile, ArtistServiceAddon, ArtistServiceItem, PortfolioPhoto
from app.catalog.models import Area, Category, ServiceTemplate
from app.core.database import SessionLocal, engine
from app.shared.enums import ArtistStatus, CategoryStatus, UserRole
from app.upload.config import get_upload_settings
from app.upload.service import r2_client
from app.user.models import User, UserAddress

# name, slug, [(subcategory name, slug, [(service template name, description)])]
CATALOG: list[tuple[str, str, list[tuple[str, str, list[tuple[str, str]]]]]] = [
    (
        "Mehendi",
        "mehendi",
        [
            (
                "Bridal Mehendi",
                "bridal-mehendi",
                [("Bridal Full Hands + Legs", "Complete bridal design, both hands up to elbow and legs up to knee.")],
            ),
            (
                "Party Mehendi",
                "party-mehendi",
                [
                    ("Simple Hands", "Light front-and-back hand design for parties."),
                    ("Guest Mehendi (per person)", "Per-guest design at functions."),
                ],
            ),
        ],
    ),
    (
        "Makeup",
        "makeup",
        [
            (
                "Bridal Makeup",
                "bridal-makeup",
                [("HD Bridal Makeup", "HD airbrush bridal look with lashes and touch-up kit.")],
            ),
            ("Party Makeup", "party-makeup", [("Softeye Party Look", "Everyday glam for parties and events.")]),
        ],
    ),
    (
        "Hair",
        "hair",
        [
            (
                "Hair Styling",
                "hair-styling",
                [
                    ("Iron Haman / Blow Dry", "Salon-grade smoothing and volumising."),
                    ("Party Hair Do", "Curls, braids or updo for events."),
                ],
            ),
            (
                "Hair Colour",
                "hair-colour",
                [("Global Colour", "Single-tone colour application, up to shoulder length.")],
            ),
        ],
    ),
    (
        "Spa & Grooming",
        "spa-grooming",
        [
            ("Facial", "facial", [("Fruit / Gold Facial", "Brightening facial with massage.")]),
            ("Thread & Wax", "thread-wax", [("Full Arms + Legs Waxing", "Rica wax full arms and legs.")]),
        ],
    ),
]

# phone, first, last, roles, active_role
CUSTOMERS = [
    ("+919845000001", "Ananya", "Sharma", [UserRole.customer], UserRole.customer),
    ("+919845000002", "Rohan", "Verma", [UserRole.customer], UserRole.customer),
]
ARTISTS = [
    (
        "+919900000001",
        "Priya",
        "Nair",
        "Henna by Priya",
        "Bangalore",
        "Indiranagar",
        12.9784,
        77.6408,
        ArtistStatus.approved,
        8,
        ["English", "Hindi", "Malayalam"],
    ),
    (
        "+919900000002",
        "Sneha",
        "Rao",
        "Glam by Sneha",
        "Bangalore",
        "Koramangala",
        12.9352,
        77.6245,
        ArtistStatus.approved,
        5,
        ["English", "Kannada", "Hindi"],
    ),
    (
        "+919900000003",
        "Aisha",
        "Khan",
        "Bridal Studio by Aisha",
        "Mumbai",
        "Andheri West",
        19.1364,
        72.8292,
        ArtistStatus.approved,
        10,
        ["English", "Hindi", "Urdu"],
    ),
    (
        "+919900000004",
        "Kavitha",
        "Iyer",
        "Kavitha Hair Studio",
        "Chennai",
        "T Nagar",
        13.0415,
        80.2331,
        ArtistStatus.pending,
        6,
        ["English", "Tamil"],
    ),
]
ADMIN_PHONE = "+919800000000"

ASSETS_DIR = Path(__file__).resolve().parent / "seed-assets"


def seed_images() -> int:
    """Upload seed-assets/**.jpg to the R2 public bucket under the same key (skip objects that exist).

    Under fake storage nothing can be uploaded, so the step is skipped — the DB rows still get their keys,
    exactly like real uploads behave in fake mode. Returns the number of newly uploaded objects.
    """
    s = get_upload_settings()
    if s.storage_provider != "r2":
        print(f"seed images: skipped (storage_provider={s.storage_provider!r}, need 'r2')")
        return 0
    client = r2_client(s.r2_account_id, s.r2_access_key_id, s.r2_secret_access_key.get_secret_value())
    paths = sorted(p for p in ASSETS_DIR.rglob("*") if p.suffix.lower() in (".jpg", ".jpeg"))
    if not paths:
        raise RuntimeError(f"seed images: no .jpg assets under {ASSETS_DIR} — refusing to seed key-only rows")
    uploaded = skipped = 0
    for path in paths:
        key = path.relative_to(ASSETS_DIR).as_posix()
        try:
            client.head_object(Bucket=s.r2_bucket, Key=key)
            skipped += 1
        except ClientError as exc:
            if exc.response["Error"]["Code"] not in ("404", "NoSuchKey"):
                print(f"seed images: head_object({key}) failed: {exc}")
                raise
            client.put_object(Bucket=s.r2_bucket, Key=key, Body=path.read_bytes(), ContentType="image/jpeg")
            uploaded += 1
    print(f"seed images: {uploaded} uploaded, {skipped} already present")
    return uploaded


async def seed_catalog(session) -> dict[str, Category]:
    by_slug: dict[str, Category] = {}
    for name, slug, subs in CATALOG:
        parent = (await session.execute(select(Category).where(Category.slug == slug))).scalar_one_or_none()
        if parent is None:
            parent = Category(slug=slug, name=name, status=CategoryStatus.active, sort_order=len(by_slug))
            session.add(parent)
            await session.flush()
        by_slug[slug] = parent
        for sub_name, sub_slug, templates in subs:
            sub = (await session.execute(select(Category).where(Category.slug == sub_slug))).scalar_one_or_none()
            if sub is None:
                sub = Category(
                    slug=sub_slug, name=sub_name, parent_id=parent.id, status=CategoryStatus.active, sort_order=0
                )
                session.add(sub)
                await session.flush()
            by_slug[sub_slug] = sub
            for order, (t_name, t_desc) in enumerate(templates):
                exists = (
                    await session.execute(
                        select(ServiceTemplate).where(
                            ServiceTemplate.subcategory_id == sub.id, ServiceTemplate.name == t_name
                        )
                    )
                ).scalar_one_or_none()
                if exists is None:
                    session.add(
                        ServiceTemplate(subcategory_id=sub.id, name=t_name, description=t_desc, sort_order=order)
                    )
    await session.flush()
    return by_slug


async def seed_user(session, phone, first, last, roles, active_role) -> User:
    user = (await session.execute(select(User).where(User.phone == phone))).scalar_one_or_none()
    if user is None:
        user = User(phone=phone, first_name=first, last_name=last, is_phone_verified=True, active_role=active_role)
        session.add(user)
    for role in roles:
        user.grant(role)
    await session.flush()
    return user


def _asset_keys(business: str) -> tuple[str, list[str]]:
    """(avatar key, cover keys) in the seed-assets layout — the single source of truth for both uploads and rows."""
    slug = business.replace(" ", "-").lower()
    return f"seed/{slug}/avatar.jpg", [f"seed/{slug}/cover-1.jpg", f"seed/{slug}/cover-2.jpg"]


async def seed_artists(session, cats: dict[str, Category], by_phone: dict[str, tuple[User, ArtistProfile]]) -> None:
    services_by_artist: dict[str, list[tuple[str, str, int, int, list[tuple[str, int, bool]]]]] = {
        "Henna by Priya": [
            (
                "bridal-mehendi",
                "Bridal Full Hands + Legs",
                1500000,
                240,
                [("Guest mehendi + family (5 people)", 250000, True)],
            ),
            ("party-mehendi", "Simple Hands", 80000, 40, []),
        ],
        "Glam by Sneha": [
            ("bridal-makeup", "HD Bridal Makeup", 2500000, 180, [("Reception look (second session)", 1200000, False)]),
            ("party-makeup", "Softeye Party Look", 350000, 60, []),
        ],
        "Bridal Studio by Aisha": [
            ("bridal-makeup", "HD Bridal Makeup", 3500000, 210, [("Hair styling with makeup", 1000000, False)]),
            ("bridal-mehendi", "Bridal Full Hands + Legs", 1800000, 240, []),
        ],
        "Kavitha Hair Studio": [
            ("hair-styling", "Iron Haman / Blow Dry", 60000, 60, []),
            ("hair-colour", "Global Colour", 200000, 90, []),
        ],
    }
    for phone, _first, _last, business, city, locality, lat, lng, status, years, langs in ARTISTS:
        avatar_key, cover_keys = _asset_keys(business)
        user = (await session.execute(select(User).where(User.phone == phone))).scalar_one()
        profile = (
            await session.execute(select(ArtistProfile).where(ArtistProfile.user_id == user.id))
        ).scalar_one_or_none()
        if profile is not None:
            if profile.photo_key is None:
                profile.photo_key = avatar_key
            services = (
                (
                    await session.execute(
                        select(ArtistServiceItem)
                        .where(ArtistServiceItem.artist_id == profile.id)
                        .order_by(ArtistServiceItem.sort_order)
                    )
                )
                .scalars()
                .all()
            )
            for i, s in enumerate(services):
                if s.photo_key is None:
                    s.photo_key = cover_keys[i % len(cover_keys)]
            await session.flush()
            by_phone[phone] = (user, profile)
            continue
        area = (
            await session.execute(select(Area).where(Area.city == city, Area.name == locality))
        ).scalar_one_or_none()
        profile = ArtistProfile(
            user_id=user.id,
            business_name=business,
            city=city,
            area_id=area.id if area else None,
            locality=locality,
            latitude=lat,
            longitude=lng,
            bio=f"{business} — {years} yrs of experience in {city}.",
            photo_key=avatar_key,
            status=status,
            experience_years=years,
            languages=langs,
            travel_radius_km=15,
            submitted_at=None if status is ArtistStatus.draft else _now(),
            reviewed_at=_now() if status is ArtistStatus.approved else None,
        )
        parent_slugs = {
            "Henna by Priya": ["mehendi"],
            "Glam by Sneha": ["makeup"],
            "Bridal Studio by Aisha": ["makeup", "mehendi"],
            "Kavitha Hair Studio": ["hair"],
        }[business]
        profile.categories = [cats[s] for s in parent_slugs]
        session.add(profile)
        await session.flush()
        for order, (sub_slug, t_name, price, dur, addons) in enumerate(services_by_artist[business]):
            sub = cats[sub_slug]
            template = (
                await session.execute(
                    select(ServiceTemplate).where(
                        ServiceTemplate.subcategory_id == sub.id, ServiceTemplate.name == t_name
                    )
                )
            ).scalar_one()
            item = ArtistServiceItem(
                artist_id=profile.id,
                category_id=sub.id,
                template_id=template.id,
                price_paise=price,
                duration_minutes=dur,
                sort_order=order,
                photo_key=cover_keys[order % len(cover_keys)],
                included_items=["Travelling kit included", "All products provided"],
            )
            session.add(item)
            await session.flush()
            for a_order, (a_name, a_price, per_person) in enumerate(addons):
                session.add(
                    ArtistServiceAddon(
                        service_id=item.id, name=a_name, price_paise=a_price, per_person=per_person, sort_order=a_order
                    )
                )
        session.add(
            PortfolioPhoto(
                artist_id=profile.id,
                storage_key=cover_keys[0],
                width=1080,
                height=1350,
                sort_order=0,
            )
        )
        session.add(
            PortfolioPhoto(
                artist_id=profile.id,
                storage_key=cover_keys[1],
                width=1080,
                height=1350,
                sort_order=1,
            )
        )
        by_phone[phone] = (user, profile)
    await session.flush()


async def seed_addresses(session, by_phone) -> None:
    for phone in ("+919845000001", "+919845000002"):
        user = (await session.execute(select(User).where(User.phone == phone))).scalar_one()
        has = (await session.execute(select(UserAddress.id).where(UserAddress.user_id == user.id))).first()
        if has is None:
            session.add(
                UserAddress(
                    user_id=user.id,
                    label="Home",
                    address=f"Flat 101, Prestige Apartments, {phone[-2:]} Main Road, Bangalore 560038",
                )
            )
    await session.flush()


def _now():
    from datetime import datetime, timezone

    return datetime.now(timezone.utc)


async def main() -> None:
    async with SessionLocal() as session:
        seed_images()
        cats = await seed_catalog(session)
        await seed_user(session, ADMIN_PHONE, "Ops", "Admin", [UserRole.admin], None)
        for phone, first, last, roles, active in CUSTOMERS:
            await seed_user(session, phone, first, last, roles, active)
        for phone, first, last, *_rest in ARTISTS:
            await seed_user(session, phone, first, last, [UserRole.artist], UserRole.artist)
        by_phone: dict[str, tuple[User, ArtistProfile]] = {}
        await seed_artists(session, cats, by_phone)
        await seed_addresses(session, by_phone)
        await session.commit()
    await engine.dispose()
    print(
        "Seeded: catalog (4 categories, 8 subcategories, 10 service templates), 1 admin, 2 customers, "
        "4 artists (3 approved, 1 pending) with services/addons/portfolio."
    )


if __name__ == "__main__":
    asyncio.run(main())
