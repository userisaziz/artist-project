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
from app.catalog.fields import FieldDef
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
            (
                "Arabic Mehendi",
                "arabic-mehendi",
                [
                    ("Arabic Full Hands", "Bold Arabic floral trails, front and back up to the wrist."),
                    ("Eid Special Mehendi", "Quick festive Arabic design for both hands."),
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
            (
                "Engagement & Nikah Makeup",
                "nikah-makeup",
                [
                    ("Nikah Soft Glam", "Elegant, long-wear look for nikah and engagement ceremonies."),
                    ("Hijab Styling + Makeup", "Makeup with a draped hijab style pinned to match the outfit."),
                ],
            ),
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
    (
        "Art",
        "art",
        [
            (
                "Calligraphy",
                "calligraphy",
                [
                    ("Arabic Name Calligraphy Frame", "Hand-inked Arabic name on textured board, framed A4."),
                    ("Nikah Certificate Calligraphy", "Hand-lettered nikah nama on premium paper."),
                ],
            ),
            (
                # Booked into a slot at the event, unlike the made-to-order frames: overrides Art's fulfilment.
                "Live Event Calligraphy",
                "live-calligraphy",
                [("Live Calligraphy at Events", "Guests' names written live on tags or cards, per hour.")],
            ),
            (
                "Canvas Painting",
                "canvas-painting",
                [
                    ("Custom Portrait Painting", "Acrylic portrait from your photo on a 16x20 in canvas."),
                    ("Islamic Wall Art", "Ayat or Asma ul Husna painting on canvas with gold leaf."),
                ],
            ),
        ],
    ),
    (
        "Custom Cards",
        "custom-cards",
        [
            (
                "Wedding Invitations",
                "wedding-invitations",
                [
                    ("Handmade Wedding Invite (per 50)", "Designed and handmade invites with envelopes, 50 pieces."),
                    ("Digital Invite + Video", "Animated e-invite and a 30-second invite video for WhatsApp."),
                ],
            ),
            (
                "Greeting Cards",
                "greeting-cards",
                [
                    ("Eid Card Set (per 10)", "Hand-painted Eid cards with envelopes, 10 pieces."),
                    ("Personalised Birthday Card", "Pop-up or shaker card personalised with names and photos."),
                ],
            ),
        ],
    ),
    (
        "Gift Boxes",
        "gift-boxes",
        [
            (
                "Aqiqah Boxes",
                "aqiqah-boxes",
                [
                    ("Aqiqah Sweet Box (per box)", "Dates, sweets and a name card in a printed keepsake box."),
                    ("Premium Aqiqah Hamper", "Wooden hamper with dates, dry fruit, attar and a custom tag."),
                ],
            ),
            (
                "Wedding Hampers",
                "wedding-hampers",
                [
                    ("Bridal Trousseau Packing", "Themed packing of up to 11 trousseau trays."),
                    ("Mehendi Favour Boxes (per 25)", "Mini favour boxes for mehendi guests, 25 pieces."),
                ],
            ),
        ],
    ),
    (
        "Crafts",
        "crafts",
        [
            (
                "Resin Art",
                "resin-art",
                [
                    ("Varmala Preservation", "Wedding garland flowers preserved in a resin frame."),
                    ("Resin Name Plate", "Custom resin nameplate for the home, 12x8 in."),
                ],
            ),
            (
                "Embroidery & Hoop Art",
                "hoop-art",
                [("Custom Embroidery Hoop", "Hand-embroidered names and dates in an 8 in hoop.")],
            ),
        ],
    ),
    (
        "Photography",
        "photography",
        [
            (
                "Wedding Photography",
                "wedding-photography",
                [
                    ("Full-day Wedding Shoot", "Candid + traditional coverage, 300 edited photos."),
                    ("Nikah Ceremony Coverage", "Up to 4 hours of coverage with 150 edited photos."),
                ],
            ),
            (
                "Pre-wedding Shoot",
                "pre-wedding-shoot",
                [("Outdoor Pre-wedding Shoot", "Two locations, outfit changes, 60 edited photos.")],
            ),
            (
                "Event Photography",
                "event-photography",
                [
                    ("Aqiqah / Birthday Coverage", "Up to 3 hours of family event coverage, 100 edited photos."),
                    ("Maternity & Newborn Shoot", "Studio or home session with props, 40 edited photos."),
                ],
            ),
        ],
    ),
]


def _field(key: str, label: str, scope: str, kind: str, **extra) -> dict:
    """One admin-style field definition (app.catalog.fields.FieldDef), validated when the catalog is seeded."""
    return {"key": key, "label": label, "scope": scope, "type": kind, **extra}


# Category slug → (fulfilment or None to inherit, its own fields). Seeded only onto rows an admin hasn't set up.
# What per-unit services in each category are counted in by default.
CATEGORY_UNITS: dict[str, str] = {
    "mehendi": "person",
    "makeup": "person",
    "hair": "person",
    "art": "piece",
    "custom-cards": "card",
    "gift-boxes": "box",
    "crafts": "piece",
    "photography": "hour",
}

CATEGORY_RULES: dict[str, tuple[str | None, list[dict]]] = {
    "mehendi": (
        "appointment",
        [
            _field("coverage", "Coverage", "listing", "select", options=["Up to wrists", "Up to elbows", "Full arms"]),
            _field(
                "styles",
                "Design styles",
                "listing",
                "multi_select",
                options=["Arabic", "Indian", "Indo-Arabic", "Minimal"],
            ),
            _field(
                "occasion", "Occasion", "booking", "select", options=["Wedding", "Engagement", "Eid", "Party", "Other"]
            ),
        ],
    ),
    "bridal-mehendi": (
        None,
        [_field("bride_name", "Bride's name", "booking", "text", help="Hidden in the design, if you like")],
    ),
    "makeup": (
        "appointment",
        [
            _field("hair_included", "Hairstyling included", "listing", "boolean"),
            _field("trial", "Trial session available", "listing", "boolean"),
            _field(
                "occasion", "Occasion", "booking", "select", options=["Wedding", "Nikah", "Reception", "Party", "Other"]
            ),
            _field("skin_type", "Skin type", "booking", "select", options=["Dry", "Oily", "Combination", "Sensitive"]),
        ],
    ),
    "hair": (
        "appointment",
        [_field("hair_length", "Hair length", "booking", "select", options=["Short", "Shoulder", "Long"])],
    ),
    "art": (
        "made_to_order",
        [
            _field("sizes", "Sizes offered", "listing", "multi_select", options=["A4", "A3", "A2", "16x20 in"]),
            _field("turnaround_days", "Turnaround", "listing", "number", min=1, max=60, unit="days"),
            _field("framed", "Comes framed", "listing", "boolean"),
            _field("text_to_write", "Names or text to write", "booking", "long_text", required=True),
            _field("size", "Size", "booking", "select", options=["A4", "A3", "A2", "16x20 in"]),
        ],
    ),
    "live-calligraphy": ("appointment", []),
    "custom-cards": (
        "made_to_order",
        [
            _field("min_order", "Minimum order", "listing", "number", min=1, max=1000, unit="cards"),
            _field("turnaround_days", "Turnaround", "listing", "number", min=1, max=60, unit="days"),
            _field("wording", "Wording on the card", "booking", "long_text", required=True),
            _field("language", "Language", "booking", "select", options=["English", "Urdu", "Hindi", "Arabic"]),
        ],
    ),
    "gift-boxes": (
        "made_to_order",
        [
            _field(
                "contents",
                "In each box",
                "listing",
                "multi_select",
                options=["Dates", "Sweets", "Dry fruit", "Attar", "Name card"],
            ),
            _field("min_order", "Minimum order", "listing", "number", min=1, max=1000, unit="boxes"),
            _field("theme", "Colour theme", "booking", "text", help="e.g. pastel blue and gold"),
        ],
    ),
    "aqiqah-boxes": (None, [_field("baby_name", "Baby's name", "booking", "text", required=True)]),
    "crafts": (
        "made_to_order",
        [
            _field("turnaround_days", "Turnaround", "listing", "number", min=1, max=90, unit="days"),
            _field("personalise", "Names and dates to include", "booking", "long_text"),
        ],
    ),
    "photography": (
        "appointment",
        [
            _field("edited_photos", "Edited photos", "listing", "number", min=10, max=3000, unit="photos"),
            _field("album", "Album", "listing", "select", options=["None", "Classic", "Premium"]),
            _field("delivery_days", "Photos delivered in", "listing", "number", min=1, max=90, unit="days"),
            _field(
                "event_type",
                "Event",
                "booking",
                "select",
                options=["Wedding", "Nikah", "Pre-wedding", "Aqiqah", "Birthday", "Other"],
            ),
            _field("venue", "Venue", "booking", "text", required=True),
        ],
    ),
}

# (business, template) → pricing (package, or per unit with a unit and minimum) and listing details.
SERVICE_OPTIONS: dict[tuple[str, str], dict] = {
    ("Henna by Priya", "Bridal Full Hands + Legs"): {
        "attributes": {"coverage": "Full arms", "styles": ["Indian", "Indo-Arabic"]}
    },
    ("Ayesha Arabic Mehendi", "Arabic Full Hands"): {"attributes": {"coverage": "Up to wrists", "styles": ["Arabic"]}},
    ("Ayesha Arabic Mehendi", "Eid Special Mehendi"): {
        "pricing_unit": "per_unit",
        "quantity_unit": "person",
        "attributes": {"styles": ["Arabic", "Minimal"]},
    },
    ("Glam by Sneha", "HD Bridal Makeup"): {"attributes": {"hair_included": False, "trial": True}},
    ("Glam by Sneha", "Softeye Party Look"): {
        "pricing_unit": "per_unit",
        "quantity_unit": "person",
        "attributes": {"hair_included": False},
    },
    ("Bridal Studio by Aisha", "HD Bridal Makeup"): {"attributes": {"hair_included": True, "trial": True}},
    ("Qalam Calligraphy Studio", "Arabic Name Calligraphy Frame"): {
        "pricing_unit": "per_unit",
        "quantity_unit": "piece",
        "attributes": {"sizes": ["A4", "A3"], "turnaround_days": 5, "framed": True},
    },
    ("Qalam Calligraphy Studio", "Live Calligraphy at Events"): {"pricing_unit": "package"},
    ("Barakah Aqiqah Boxes", "Aqiqah Sweet Box (per box)"): {
        "pricing_unit": "per_unit",
        "quantity_unit": "box",
        "min_quantity": 25,
        "attributes": {"contents": ["Dates", "Sweets", "Name card"], "min_order": 25},
    },
    ("Paper Petals Cards", "Handmade Wedding Invite (per 50)"): {
        "attributes": {"min_order": 50, "turnaround_days": 10}
    },
    ("Resin & Bloom Crafts", "Varmala Preservation"): {"attributes": {"turnaround_days": 21}},
    ("Frames by Rahul", "Full-day Wedding Shoot"): {
        "attributes": {"edited_photos": 300, "album": "Premium", "delivery_days": 30}
    },
    ("Frames by Rahul", "Nikah Ceremony Coverage"): {
        "attributes": {"edited_photos": 150, "album": "Classic", "delivery_days": 21}
    },
    ("Lakshmi Canvas Art", "Custom Portrait Painting"): {
        "attributes": {"sizes": ["16x20 in"], "turnaround_days": 14, "framed": False}
    },
}

# phone, first, last, roles, active_role
CUSTOMERS = [
    ("+919845000001", "Ananya", "Sharma", [UserRole.customer], UserRole.customer),
    ("+919845000002", "Rohan", "Verma", [UserRole.customer], UserRole.customer),
    ("+919845000003", "Fatima", "Sheikh", [UserRole.customer], UserRole.customer),
    ("+919845000004", "Zoya", "Mirza", [UserRole.customer], UserRole.customer),
    ("+919845000005", "Arjun", "Menon", [UserRole.customer], UserRole.customer),
    ("+919845000006", "Meera", "Kulkarni", [UserRole.customer], UserRole.customer),
    ("+919845000007", "Imran", "Qureshi", [UserRole.customer], UserRole.customer),
    ("+919845000008", "Divya", "Reddy", [UserRole.customer], UserRole.customer),
]
# phone, city, address — one saved address per customer
ADDRESSES = [
    ("+919845000001", "Flat 101, Prestige Apartments, 12th Main Road, Indiranagar, Bangalore 560038"),
    ("+919845000002", "House 22, 5th Cross, Koramangala 4th Block, Bangalore 560034"),
    ("+919845000003", "Flat 4B, Banjara Residency, Road No. 12, Banjara Hills, Hyderabad 500034"),
    ("+919845000004", "702, Sea Breeze, Carter Road, Bandra West, Mumbai 400050"),
    ("+919845000005", "Villa 9, Palm Meadows, Whitefield, Bangalore 560066"),
    ("+919845000006", "B-14, Kumar Park, Koregaon Park, Pune 411001"),
    ("+919845000007", "Flat 3, Al Noor Heights, Tolichowki, Hyderabad 500008"),
    ("+919845000008", "12, 3rd Avenue, Anna Nagar, Chennai 600040"),
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
    (
        "+919900000005",
        "Mariam",
        "Siddiqui",
        "Qalam Calligraphy Studio",
        "Hyderabad",
        "Banjara Hills",
        17.4126,
        78.4392,
        ArtistStatus.approved,
        7,
        ["English", "Urdu", "Hindi"],
    ),
    (
        "+919900000006",
        "Hiba",
        "Fathima",
        "Barakah Aqiqah Boxes",
        "Hyderabad",
        "Tolichowki",
        17.3973,
        78.4183,
        ArtistStatus.approved,
        4,
        ["English", "Urdu", "Telugu"],
    ),
    (
        "+919900000007",
        "Nidhi",
        "Jain",
        "Paper Petals Cards",
        "Bangalore",
        "Jayanagar",
        12.9299,
        77.5826,
        ArtistStatus.approved,
        6,
        ["English", "Hindi", "Kannada"],
    ),
    (
        "+919900000008",
        "Sana",
        "Patel",
        "Resin & Bloom Crafts",
        "Pune",
        "Koregaon Park",
        18.5362,
        73.8939,
        ArtistStatus.approved,
        3,
        ["English", "Hindi", "Marathi", "Gujarati"],
    ),
    (
        "+919900000009",
        "Rahul",
        "Desai",
        "Frames by Rahul",
        "Mumbai",
        "Bandra West",
        19.0596,
        72.8295,
        ArtistStatus.approved,
        9,
        ["English", "Hindi", "Marathi"],
    ),
    (
        "+919900000010",
        "Ayesha",
        "Begum",
        "Ayesha Arabic Mehendi",
        "Hyderabad",
        "Mehdipatnam",
        17.3950,
        78.4410,
        ArtistStatus.approved,
        11,
        ["English", "Urdu", "Telugu"],
    ),
    (
        "+919900000011",
        "Lakshmi",
        "Pillai",
        "Lakshmi Canvas Art",
        "Chennai",
        "Adyar",
        13.0012,
        80.2565,
        ArtistStatus.approved,
        12,
        ["English", "Tamil", "Malayalam"],
    ),
    (
        "+919900000012",
        "Noor",
        "Ahmed",
        "Noor Nikah Glam",
        "Bangalore",
        "Frazer Town",
        12.9986,
        77.6146,
        ArtistStatus.pending,
        2,
        ["English", "Urdu", "Hindi"],
    ),
]

# business → what every service of theirs includes; artists not listed get the on-site default
DEFAULT_INCLUDED = ["Travelling kit included", "All products provided"]
ARTIST_INCLUDED: dict[str, list[str]] = {
    "Qalam Calligraphy Studio": ["Premium paper and inks", "One round of revisions"],
    "Barakah Aqiqah Boxes": ["Custom name card", "Doorstep delivery within the city"],
    "Paper Petals Cards": ["Design proof before printing", "Envelopes included"],
    "Resin & Bloom Crafts": ["Pickup of flowers", "Gift-ready packaging"],
    "Frames by Rahul": ["Online gallery", "High-resolution downloads"],
    "Lakshmi Canvas Art": ["Ready-to-hang frame", "Progress photos"],
}

# business → parent category slugs
ARTIST_CATEGORIES: dict[str, list[str]] = {
    "Henna by Priya": ["mehendi"],
    "Glam by Sneha": ["makeup"],
    "Bridal Studio by Aisha": ["makeup", "mehendi"],
    "Kavitha Hair Studio": ["hair"],
    "Qalam Calligraphy Studio": ["art", "custom-cards"],
    "Barakah Aqiqah Boxes": ["gift-boxes"],
    "Paper Petals Cards": ["custom-cards", "crafts"],
    "Resin & Bloom Crafts": ["crafts"],
    "Frames by Rahul": ["photography"],
    "Ayesha Arabic Mehendi": ["mehendi"],
    "Lakshmi Canvas Art": ["art"],
    "Noor Nikah Glam": ["makeup"],
}

# business → [(subcategory slug, template name, price paise, minutes, [(addon, price paise, per person)])]
ARTIST_SERVICES: dict[str, list[tuple[str, str, int, int, list[tuple[str, int, bool]]]]] = {
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
    "Qalam Calligraphy Studio": [
        ("calligraphy", "Arabic Name Calligraphy Frame", 250000, 120, [("Gold leaf detailing", 80000, False)]),
        ("calligraphy", "Nikah Certificate Calligraphy", 450000, 180, []),
        ("live-calligraphy", "Live Calligraphy at Events", 600000, 60, [("Extra hour", 400000, False)]),
        ("wedding-invitations", "Handmade Wedding Invite (per 50)", 1200000, 480, []),
    ],
    "Barakah Aqiqah Boxes": [
        ("aqiqah-boxes", "Aqiqah Sweet Box (per box)", 35000, 30, [("Name-printed ribbon", 3000, True)]),
        ("aqiqah-boxes", "Premium Aqiqah Hamper", 250000, 60, [("Attar bottle", 40000, False)]),
        ("wedding-hampers", "Mehendi Favour Boxes (per 25)", 300000, 120, []),
    ],
    "Paper Petals Cards": [
        (
            "wedding-invitations",
            "Handmade Wedding Invite (per 50)",
            900000,
            480,
            [("Wax seal on envelopes", 150000, False)],
        ),
        ("wedding-invitations", "Digital Invite + Video", 350000, 240, []),
        ("greeting-cards", "Eid Card Set (per 10)", 120000, 120, []),
        ("greeting-cards", "Personalised Birthday Card", 60000, 60, []),
    ],
    "Resin & Bloom Crafts": [
        ("resin-art", "Varmala Preservation", 650000, 240, [("LED backlight", 120000, False)]),
        ("resin-art", "Resin Name Plate", 280000, 120, []),
        ("hoop-art", "Custom Embroidery Hoop", 180000, 180, []),
    ],
    "Frames by Rahul": [
        ("wedding-photography", "Full-day Wedding Shoot", 6500000, 600, [("Drone coverage", 1500000, False)]),
        ("wedding-photography", "Nikah Ceremony Coverage", 2500000, 240, []),
        ("pre-wedding-shoot", "Outdoor Pre-wedding Shoot", 3500000, 300, []),
        ("event-photography", "Aqiqah / Birthday Coverage", 1200000, 180, []),
        ("event-photography", "Maternity & Newborn Shoot", 1500000, 120, []),
    ],
    "Ayesha Arabic Mehendi": [
        ("arabic-mehendi", "Arabic Full Hands", 150000, 60, []),
        ("arabic-mehendi", "Eid Special Mehendi", 70000, 30, [("Glitter outline", 20000, False)]),
        ("bridal-mehendi", "Bridal Full Hands + Legs", 1200000, 240, [("Guest mehendi (per person)", 30000, True)]),
    ],
    "Lakshmi Canvas Art": [
        ("canvas-painting", "Custom Portrait Painting", 800000, 600, []),
        ("canvas-painting", "Islamic Wall Art", 550000, 480, []),
    ],
    "Noor Nikah Glam": [
        ("nikah-makeup", "Nikah Soft Glam", 1500000, 150, []),
        ("nikah-makeup", "Hijab Styling + Makeup", 450000, 75, []),
    ],
}
ARTIST_BIOS = {
    "Qalam Calligraphy Studio": "Arabic and Urdu calligraphy for names, nikah namas and live event lettering.",
    "Barakah Aqiqah Boxes": "Handpacked aqiqah sweet boxes and hampers, custom-printed with your baby's name.",
    "Paper Petals Cards": "Handmade wedding invites, Eid cards and keepsake stationery, designed to order.",
    "Resin & Bloom Crafts": "Varmala preservation, resin nameplates and embroidered keepsakes from Pune.",
    "Frames by Rahul": "Candid wedding, nikah and family-event photography across Mumbai.",
    "Ayesha Arabic Mehendi": "Bold Arabic and bridal mehendi in Hyderabad — 11 years, 900+ brides.",
    "Lakshmi Canvas Art": "Custom portraits and Islamic wall art in acrylic and gold leaf.",
    "Noor Nikah Glam": "Soft-glam nikah makeup with hijab styling.",
}
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
    for artist_row in ARTISTS:
        avatar_key, cover_keys = _asset_keys(artist_row[3])
        for key in [k for k in (avatar_key, *cover_keys) if k]:
            if not (ASSETS_DIR / key).is_file():
                raise RuntimeError(f"seed images: row key {key} has no asset under {ASSETS_DIR}")
    uploaded = skipped = 0
    for path in paths:
        key = path.relative_to(ASSETS_DIR).as_posix()
        try:
            client.head_object(Bucket=s.r2_bucket, Key=key)
            skipped += 1
        except ClientError as exc:
            if exc.response["Error"]["Code"] not in ("404", "NoSuchKey", "NotFound"):
                print(f"seed images: head_object({key}) failed: {exc}")
                raise
            client.put_object(Bucket=s.r2_bucket, Key=key, Body=path.read_bytes(), ContentType="image/jpeg")
            uploaded += 1
    print(f"seed images: {uploaded} uploaded, {skipped} already present")
    return uploaded


def _apply_rules(category: Category) -> None:
    """Seed a category's fulfilment and fields, unless an admin has already set either."""
    if category.slug not in CATEGORY_RULES or category.fulfilment is not None or category.field_schema:
        return
    fulfilment, fields = CATEGORY_RULES[category.slug]
    category.fulfilment = fulfilment
    category.default_unit = CATEGORY_UNITS.get(category.slug)
    category.field_schema = [FieldDef.model_validate(f).model_dump(mode="json") for f in fields]


async def seed_catalog(session) -> dict[str, Category]:
    by_slug: dict[str, Category] = {}
    for name, slug, subs in CATALOG:
        parent = (await session.execute(select(Category).where(Category.slug == slug))).scalar_one_or_none()
        if parent is None:
            parent = Category(slug=slug, name=name, status=CategoryStatus.active, sort_order=len(by_slug))
            session.add(parent)
            await session.flush()
        by_slug[slug] = parent
        _apply_rules(parent)
        for sub_name, sub_slug, templates in subs:
            sub = (await session.execute(select(Category).where(Category.slug == sub_slug))).scalar_one_or_none()
            if sub is None:
                sub = Category(
                    slug=sub_slug, name=sub_name, parent_id=parent.id, status=CategoryStatus.active, sort_order=0
                )
                session.add(sub)
                await session.flush()
            by_slug[sub_slug] = sub
            _apply_rules(sub)
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


def _asset_keys(business: str) -> tuple[str | None, list[str]]:
    """(avatar key, cover keys) in the seed-assets layout — the single source of truth for both uploads and rows.

    Artists without a folder under seed-assets/seed/ get (None, []): their rows go in without photos rather than
    borrowing another artist's (a henna photo on a photographer's profile would mislead)."""
    slug = business.replace(" ", "-").replace("&", "and").lower()
    if not (ASSETS_DIR / "seed" / slug).is_dir():
        return None, []
    return f"seed/{slug}/avatar.jpg", [f"seed/{slug}/cover-1.jpg", f"seed/{slug}/cover-2.jpg"]


async def seed_artists(session, cats: dict[str, Category], by_phone: dict[str, tuple[User, ArtistProfile]]) -> None:
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
                if s.photo_key is None and cover_keys:
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
            bio=ARTIST_BIOS.get(business, f"{business} — {years} yrs of experience in {city}."),
            photo_key=avatar_key,
            status=status,
            experience_years=years,
            languages=langs,
            travel_radius_km=15,
            submitted_at=None if status is ArtistStatus.draft else _now(),
            reviewed_at=_now() if status is ArtistStatus.approved else None,
        )
        parent_slugs = ARTIST_CATEGORIES[business]
        profile.categories = [cats[s] for s in parent_slugs]
        session.add(profile)
        await session.flush()
        for order, (sub_slug, t_name, price, dur, addons) in enumerate(ARTIST_SERVICES[business]):
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
                photo_key=cover_keys[order % len(cover_keys)] if cover_keys else None,
                included_items=ARTIST_INCLUDED.get(business, DEFAULT_INCLUDED),
                **SERVICE_OPTIONS.get((business, t_name), {}),
            )
            session.add(item)
            await session.flush()
            for a_order, (a_name, a_price, per_person) in enumerate(addons):
                session.add(
                    ArtistServiceAddon(
                        service_id=item.id, name=a_name, price_paise=a_price, per_person=per_person, sort_order=a_order
                    )
                )
        for p_order, key in enumerate(cover_keys):
            session.add(
                PortfolioPhoto(artist_id=profile.id, storage_key=key, width=1080, height=1350, sort_order=p_order)
            )
        by_phone[phone] = (user, profile)
    await session.flush()


async def seed_addresses(session) -> None:
    for phone, address in ADDRESSES:
        user = (await session.execute(select(User).where(User.phone == phone))).scalar_one()
        has = (await session.execute(select(UserAddress.id).where(UserAddress.user_id == user.id))).first()
        if has is None:
            session.add(UserAddress(user_id=user.id, label="Home", address=address))
    await session.flush()


def _now():
    from datetime import UTC, datetime

    return datetime.now(UTC)


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
        await seed_addresses(session)
        await session.commit()
    await engine.dispose()
    subs = sum(len(c[2]) for c in CATALOG)
    templates = sum(len(t) for c in CATALOG for _n, _s, t in c[2])
    approved = sum(1 for a in ARTISTS if a[8] is ArtistStatus.approved)
    print(
        f"Seeded: catalog ({len(CATALOG)} categories, {subs} subcategories, {templates} service templates), 1 admin, "
        f"{len(CUSTOMERS)} customers, {len(ARTISTS)} artists ({approved} approved, {len(ARTISTS) - approved} pending) "
        "with services/addons/portfolio."
    )


if __name__ == "__main__":
    asyncio.run(main())
