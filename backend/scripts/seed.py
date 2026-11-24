"""Seed demo data into the active database: `python -m scripts.seed` (from backend/).

Idempotent — every block checks for its own rows first (slugs / phones / user_id / seeded code), so re-running
adds nothing. Seeds: catalog categories + subcategories + service templates with their rules, an admin, customers,
and artist profiles (approved + one pending) with services, addons and portfolio photos, plus avatar
and service photos; image assets are uploaded to R2 by `seed_images`. Then the demo activity the screens read:
weekly working hours and days off, bookings across every status, reviews of the completed ones.

Bookings, money and answers go through the app's own code (`booking.service.new_booking`, `catalog.fields`), so a
seeded row is what the API would have written — including deterministic codes, because `new_code()` is random and
a random code would add a second copy of every row on the next run.
"""

import asyncio
from datetime import UTC, date, datetime, timedelta
from hashlib import blake2b
from pathlib import Path
from typing import Any, NamedTuple

from botocore.exceptions import ClientError
from sqlalchemy import func, select

from app.artist.constants import PricingUnit
from app.artist.models import (
    ArtistDayOff,
    ArtistProfile,
    ArtistServiceAddon,
    ArtistServiceItem,
    ArtistWorkingHour,
    PortfolioPhoto,
)
from app.booking import rules
from app.booking import service as booking_service
from app.booking.config import get_booking_settings
from app.booking.models import Booking
from app.booking.schemas import BookingAddonIn
from app.booking.utils import CODE_ALPHABET, clean_reason, shift_month
from app.catalog import fields as catalog_fields
from app.catalog.fields import FieldDef
from app.catalog.models import Area, Category, ServiceTemplate
from app.core.database import SessionLocal, engine
from app.review.filters import review_flag
from app.review.models import PUBLIC_REVIEW, Review
from app.shared.enums import ArtistStatus, BookingStatus, CategoryStatus, ReviewStatus, UserRole
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

# --- demo activity: the week each artist works, the jobs they did, and what customers said about them ---------

_ANANYA, _ROHAN, _FATIMA, _ZOYA, _ARJUN, _MEERA, _IMRAN, _DIVYA = (phone for phone, *_ in CUSTOMERS)
_ADDRESS_BY_PHONE = dict(ADDRESSES)


class Day(NamedTuple):
    """One weekday of an artist's saved week. A closed day still carries hours: the table requires them."""

    is_open: bool
    open_hour: int
    close_hour: int


def _works(open_hour: int, close_hour: int) -> Day:
    return Day(True, open_hour, close_hour)


def _shut(open_hour: int = 10, close_hour: int = 16) -> Day:
    return Day(False, open_hour, close_hour)


# business → its week, Monday first (weekday 0 is Monday). Hours stay around 9-to-18 so a seeded start is inside
# both the artist's own week and the 9–17 band the mobile app previews before it asks the server.
ARTIST_WEEK: dict[str, tuple[Day, ...]] = {
    "Henna by Priya": (
        _shut(),
        _works(9, 18),
        _works(9, 18),
        _works(9, 18),
        _works(9, 18),
        _works(9, 18),
        _works(9, 14),
    ),
    "Glam by Sneha": (
        _works(9, 18),
        _works(9, 18),
        _works(9, 18),
        _works(9, 18),
        _works(9, 18),
        _works(9, 18),
        _shut(),
    ),
    "Bridal Studio by Aisha": (
        _shut(),
        _works(9, 19),
        _works(9, 19),
        _works(9, 19),
        _works(9, 19),
        _works(9, 19),
        _works(9, 14),
    ),
    "Kavitha Hair Studio": (
        _shut(),
        _works(10, 19),
        _works(10, 19),
        _works(10, 19),
        _works(10, 19),
        _works(10, 19),
        _works(10, 16),
    ),
    "Qalam Calligraphy Studio": (
        _works(10, 18),
        _works(10, 18),
        _works(10, 18),
        _works(10, 18),
        _works(10, 18),
        _works(10, 14),
        _shut(),
    ),
    "Barakah Aqiqah Boxes": (
        _works(10, 17),
        _works(10, 17),
        _works(10, 17),
        _works(10, 17),
        _works(10, 17),
        _works(10, 17),
        _shut(),
    ),
    "Paper Petals Cards": (_works(9, 17), _works(9, 17), _works(9, 17), _works(9, 17), _works(9, 17), _shut(), _shut()),
    "Resin & Bloom Crafts": (
        _works(10, 18),
        _works(10, 18),
        _works(10, 18),
        _works(10, 18),
        _works(10, 18),
        _works(10, 18),
        _shut(),
    ),
    "Frames by Rahul": (_shut(), _shut(), _works(8, 20), _works(8, 20), _works(8, 20), _works(8, 20), _works(8, 20)),
    "Ayesha Arabic Mehendi": (
        _shut(),
        _works(10, 19),
        _works(10, 19),
        _works(10, 19),
        _works(10, 19),
        _works(10, 19),
        _works(10, 15),
    ),
    "Lakshmi Canvas Art": (
        _works(10, 18),
        _works(10, 18),
        _works(10, 18),
        _works(10, 18),
        _works(10, 18),
        _shut(),
        _shut(),
    ),
    "Noor Nikah Glam": (
        _shut(),
        _works(9, 18),
        _works(9, 18),
        _works(9, 18),
        _works(9, 18),
        _works(9, 18),
        _works(9, 15),
    ),
}

# business → days of *next* month they take off (never past the 26th, so every month has them, and naming the month
# rather than an offset from today keeps a rerun from stacking another day off on the artist).
DAYS_OFF: dict[str, tuple[int, ...]] = {
    "Henna by Priya": (12,),
    "Glam by Sneha": (5,),
    "Frames by Rahul": (21,),
    "Ayesha Arabic Mehendi": (8, 26),
}


class BookingRow(NamedTuple):
    """One demo booking, in the shape `booking.service.new_booking` writes.

    `tag` is the row's identity: it seeds the human-readable code and joins the review to it. `day` is an IST
    offset from the day the seeder runs (negative = a job already done, positive = upcoming), `slot` the nth
    hourly start the artist's week offers on that day for that service. `extras` pick add-ons by one word of the
    artist's own name for them, `guests` is the head count for a per-person service, `answers` the category's
    booking fields, and `reason` the artist's or customer's word for a declined or cancelled one.
    """

    tag: str
    service: str
    customer: str
    day: int
    slot: int
    status: BookingStatus
    guests: int = 1
    extras: tuple[tuple[str, int], ...] = ()
    answers: dict[str, Any] | None = None
    note: str | None = None
    place: str | None = None
    reason: str | None = None


# artist business → their demo jobs. A customer's saved address is where an at-home service happens; `place` is the
# venue or hall for the ones that don't (a wedding shoot, a live calligraphy panel, a box pickup at the studio).
# Nothing here books a made_to_order service through the "book now" path: those rows are quote conversions, which
# is how the app itself turns an accepted quote into a confirmed booking, so they start life confirmed.
BOOKINGS: dict[str, list[BookingRow]] = {
    "Henna by Priya": [
        BookingRow(
            "priya-1",
            "Bridal Full Hands + Legs",
            _ANANYA,
            -40,
            2,
            BookingStatus.completed,
            extras=(("guest", 5),),
            answers={"occasion": "Wedding", "bride_name": "Ananya"},
        ),
        BookingRow(
            "priya-2",
            "Simple Hands",
            _ROHAN,
            -12,
            5,
            BookingStatus.completed,
            answers={"occasion": "Party"},
            note="For my fiancée and her two cousins.",
        ),
        BookingRow(
            "priya-3",
            "Bridal Full Hands + Legs",
            _ARJUN,
            -19,
            1,
            BookingStatus.completed,
            extras=(("guest", 3),),
            answers={"occasion": "Wedding", "bride_name": "Kavya"},
            note="My sister's wedding — the design is for the bride.",
        ),
        BookingRow("priya-4", "Simple Hands", _ANANYA, -7, 3, BookingStatus.completed, answers={"occasion": "Eid"}),
        BookingRow(
            "priya-5",
            "Bridal Full Hands + Legs",
            _ROHAN,
            -2,
            0,
            BookingStatus.completed,
            answers={"occasion": "Engagement", "bride_name": "Meher"},
        ),
        BookingRow("priya-6", "Simple Hands", _ARJUN, +5, 6, BookingStatus.confirmed, answers={"occasion": "Party"}),
        BookingRow(
            "priya-7",
            "Bridal Full Hands + Legs",
            _ROHAN,
            +12,
            2,
            BookingStatus.requested,
            extras=(("guest", 4),),
            answers={"occasion": "Wedding", "bride_name": "Meher"},
            note="Four of us at the mehendi, and I'd like the peacock panel on the bride's hands.",
        ),
    ],
    "Glam by Sneha": [
        BookingRow(
            "sneha-1",
            "HD Bridal Makeup",
            _ANANYA,
            -41,
            1,
            BookingStatus.completed,
            answers={"occasion": "Wedding", "skin_type": "Combination"},
            note="The morning of the wedding, at my parents' place.",
        ),
        BookingRow(
            "sneha-2",
            "Softeye Party Look",
            _ROHAN,
            -26,
            4,
            BookingStatus.completed,
            guests=3,
            answers={"occasion": "Party", "skin_type": "Oily"},
        ),
        BookingRow(
            "sneha-3",
            "HD Bridal Makeup",
            _ARJUN,
            -13,
            3,
            BookingStatus.completed,
            extras=(("reception", 1),),
            answers={"occasion": "Reception", "skin_type": "Dry"},
        ),
        BookingRow(
            "sneha-4",
            "HD Bridal Makeup",
            _ROHAN,
            -5,
            0,
            BookingStatus.completed,
            answers={"occasion": "Nikah", "skin_type": "Sensitive"},
            note="My sister's nikah, with the hijab drape.",
        ),
        BookingRow(
            "sneha-5",
            "Softeye Party Look",
            _ARJUN,
            -38,
            2,
            BookingStatus.completed,
            guests=2,
            answers={"occasion": "Other", "skin_type": "Combination"},
        ),
        BookingRow(
            "sneha-6",
            "Softeye Party Look",
            _ARJUN,
            +3,
            7,
            BookingStatus.confirmed,
            guests=2,
            answers={"occasion": "Party", "skin_type": "Combination"},
        ),
    ],
    "Bridal Studio by Aisha": [
        BookingRow(
            "aisha-1",
            "HD Bridal Makeup",
            _ZOYA,
            -70,
            1,
            BookingStatus.completed,
            extras=(("hair", 1),),
            answers={"occasion": "Wedding", "skin_type": "Dry"},
        ),
        BookingRow(
            "aisha-2",
            "Bridal Full Hands + Legs",
            _ZOYA,
            -71,
            0,
            BookingStatus.completed,
            answers={"occasion": "Wedding", "bride_name": "Zoya"},
        ),
        BookingRow(
            "aisha-3",
            "HD Bridal Makeup",
            _FATIMA,
            -34,
            4,
            BookingStatus.completed,
            answers={"occasion": "Wedding", "skin_type": "Combination"},
            place="Sunbeam Banquet Hall, Linking Road, Santacruz West, Mumbai 400054",
            note="A destination wedding — we flew in from Hyderabad for the day.",
        ),
        BookingRow(
            "aisha-4",
            "Bridal Full Hands + Legs",
            _DIVYA,
            -20,
            2,
            BookingStatus.completed,
            answers={"occasion": "Wedding", "bride_name": "Divya"},
            place="Rangmandir Banquets, Saki V Road, Malad West, Mumbai 400064",
        ),
        BookingRow(
            "aisha-5",
            "HD Bridal Makeup",
            _ZOYA,
            +6,
            3,
            BookingStatus.confirmed,
            answers={"occasion": "Reception", "skin_type": "Combination"},
        ),
        BookingRow(
            "aisha-6",
            "Bridal Full Hands + Legs",
            _MEERA,
            -28,
            1,
            BookingStatus.completed,
            answers={"occasion": "Wedding", "bride_name": "Rani"},
            place="Verandah Palace Banquets, Sane Guruji Marg, Grant Road, Mumbai 400007",
        ),
    ],
    "Qalam Calligraphy Studio": [
        BookingRow(
            "qalam-1",
            "Live Calligraphy at Events",
            _FATIMA,
            -10,
            3,
            BookingStatus.completed,
            extras=(("extra", 1),),
            answers={"text_to_write": "Ali & Fatima — Barakallahu Lakuma"},
            note="Two live panels at the reception, and one hour more than the quote.",
        ),
        BookingRow(
            "qalam-2",
            "Live Calligraphy at Events",
            _IMRAN,
            -22,
            1,
            BookingStatus.completed,
            answers={"text_to_write": "Ya Qalam"},
            note="Three panels for the mehndi night.",
        ),
        BookingRow(
            "qalam-3",
            "Live Calligraphy at Events",
            _IMRAN,
            +8,
            2,
            BookingStatus.confirmed,
            answers={"text_to_write": "Zaid, Amina & Bilal"},
        ),
    ],
    "Barakah Aqiqah Boxes": [
        BookingRow(
            "hiba-1",
            "Aqiqah Sweet Box (per box)",
            _IMRAN,
            -15,
            2,
            BookingStatus.completed,
            extras=(("ribbon", 25),),
            answers={"baby_name": "Zaid", "theme": "pastel blue and gold"},
            note="Twenty-five boxes for the aqiqah lunch.",
        ),
        BookingRow(
            "hiba-2",
            "Premium Aqiqah Hamper",
            _FATIMA,
            +4,
            1,
            BookingStatus.confirmed,
            extras=(("attar", 1),),
            answers={"baby_name": "Eesa", "theme": "green and cream"},
        ),
        BookingRow(
            "hiba-3",
            "Mehendi Favour Boxes (per 25)",
            _FATIMA,
            -8,
            4,
            BookingStatus.completed,
            answers={"theme": "peach and gold"},
            note="Favours for my cousin's mehendi.",
        ),
    ],
    "Paper Petals Cards": [
        BookingRow(
            "nidhi-1",
            "Eid Card Set (per 10)",
            _ANANYA,
            -31,
            3,
            BookingStatus.completed,
            answers={"wording": "Eid Mubarak — Ananya & family", "language": "English"},
        ),
        BookingRow(
            "nidhi-2",
            "Handmade Wedding Invite (per 50)",
            _ARJUN,
            -12,
            1,
            BookingStatus.completed,
            extras=(("wax", 1),),
            answers={"wording": "Arjun weds Kavya — 14 March", "language": "English"},
        ),
        BookingRow(
            "nidhi-3",
            "Personalised Birthday Card",
            _ROHAN,
            +3,
            5,
            BookingStatus.confirmed,
            answers={"wording": "Happy 30th, Meher!", "language": "Hindi"},
        ),
        BookingRow(
            "nidhi-4",
            "Digital Invite + Video",
            _ANANYA,
            +14,
            2,
            BookingStatus.cancelled,
            answers={"wording": "Sangeetha — 12 April", "language": "English"},
            reason="We moved the date, so we'll order again closer to it.",
        ),
    ],
    "Resin & Bloom Crafts": [
        BookingRow(
            "sana-1",
            "Varmala Preservation",
            _MEERA,
            -45,
            2,
            BookingStatus.completed,
            extras=(("led", 1),),
            answers={"personalise": "Meera & Rohan, 14 February"},
        ),
        BookingRow(
            "sana-2",
            "Resin Name Plate",
            _MEERA,
            -6,
            4,
            BookingStatus.completed,
            answers={"personalise": "House of Kulkarni"},
        ),
        BookingRow(
            "sana-3",
            "Custom Embroidery Hoop",
            _ROHAN,
            +18,
            3,
            BookingStatus.confirmed,
            answers={"personalise": "Ananya & Arjun"},
            note="I'll pick it up in Pune next month.",
            place="Resin & Bloom Crafts, N.D. India Colony Road, Koregaon Park, Pune 411001",
        ),
    ],
    "Frames by Rahul": [
        BookingRow(
            "rahul-1",
            "Full-day Wedding Shoot",
            _ZOYA,
            -69,
            0,
            BookingStatus.completed,
            extras=(("drone", 1),),
            answers={"event_type": "Wedding", "venue": "Sunbeam Banquet Hall, Santacruz West"},
            place="Sunbeam Banquet Hall, Linking Road, Santacruz West, Mumbai 400054",
        ),
        BookingRow(
            "rahul-2",
            "Nikah Ceremony Coverage",
            _FATIMA,
            -34,
            1,
            BookingStatus.completed,
            answers={"event_type": "Nikah", "venue": "Sunbeam Banquet Hall, Santacruz West"},
            place="Sunbeam Banquet Hall, Linking Road, Santacruz West, Mumbai 400054",
        ),
        BookingRow(
            "rahul-3",
            "Outdoor Pre-wedding Shoot",
            _ZOYA,
            -48,
            3,
            BookingStatus.completed,
            answers={"event_type": "Pre-wedding", "venue": "Jehangir Art Gallery, Kala Ghoda"},
            place="Jehangir Art Gallery, Ramdas Pai Marg, Kala Ghoda, Fort, Mumbai 400001",
        ),
        BookingRow(
            "rahul-4",
            "Aqiqah / Birthday Coverage",
            _IMRAN,
            -16,
            5,
            BookingStatus.completed,
            answers={"event_type": "Aqiqah", "venue": "Al Noor Community Hall, Kurla West"},
            place="Al Noor Community Hall, 100 Feet Road, Kurla West, Mumbai 400070",
            note="Our family is in Mumbai for the aqiqah.",
        ),
        BookingRow(
            "rahul-5",
            "Maternity & Newborn Shoot",
            _ZOYA,
            -8,
            6,
            BookingStatus.completed,
            answers={"event_type": "Other", "venue": "Our place, Carter Road"},
        ),
        BookingRow(
            "rahul-6",
            "Full-day Wedding Shoot",
            _DIVYA,
            +21,
            1,
            BookingStatus.confirmed,
            answers={"event_type": "Wedding", "venue": "Rangmandir Banquets, Malad West"},
            place="Rangmandir Banquets, Saki V Road, Malad West, Mumbai 400064",
            note="The whole day, from the mehendi to the reception.",
        ),
        BookingRow(
            "rahul-7",
            "Nikah Ceremony Coverage",
            _ANANYA,
            +18,
            3,
            BookingStatus.requested,
            answers={"event_type": "Nikah", "venue": "Silver Oak Convention, Begur"},
            place="Silver Oak Convention, Begur Road, Bangalore 560076",
            note="He shot my cousin's nikah in March; can you travel for the day?",
        ),
    ],
    "Ayesha Arabic Mehendi": [
        BookingRow(
            "ayesha-1", "Arabic Full Hands", _FATIMA, -50, 3, BookingStatus.completed, answers={"occasion": "Wedding"}
        ),
        BookingRow(
            "ayesha-2",
            "Eid Special Mehendi",
            _IMRAN,
            -42,
            5,
            BookingStatus.completed,
            guests=4,
            extras=(("glitter", 1),),
            answers={"occasion": "Eid"},
        ),
        BookingRow(
            "ayesha-3",
            "Bridal Full Hands + Legs",
            _IMRAN,
            -24,
            0,
            BookingStatus.completed,
            extras=(("guest", 6),),
            answers={"occasion": "Wedding", "bride_name": "Nadia"},
        ),
        BookingRow(
            "ayesha-4",
            "Eid Special Mehendi",
            _FATIMA,
            -9,
            6,
            BookingStatus.completed,
            guests=3,
            answers={"occasion": "Party"},
        ),
        BookingRow(
            "ayesha-5", "Arabic Full Hands", _IMRAN, +4, 2, BookingStatus.confirmed, answers={"occasion": "Eid"}
        ),
        BookingRow(
            "ayesha-6",
            "Bridal Full Hands + Legs",
            _FATIMA,
            -12,
            0,
            BookingStatus.declined,
            answers={"occasion": "Wedding", "bride_name": "Layla"},
            reason="I was away that week — sorry.",
        ),
        BookingRow(
            "ayesha-7",
            "Eid Special Mehendi",
            _IMRAN,
            +17,
            4,
            BookingStatus.cancelled,
            guests=2,
            answers={"occasion": "Eid"},
            reason="It rained all weekend and we dropped the plan.",
        ),
    ],
    "Lakshmi Canvas Art": [
        BookingRow(
            "lakshmi-1",
            "Custom Portrait Painting",
            _DIVYA,
            -60,
            1,
            BookingStatus.completed,
            answers={"text_to_write": "Amma, 2026", "size": "16x20 in"},
        ),
        BookingRow(
            "lakshmi-2",
            "Islamic Wall Art",
            _FATIMA,
            -25,
            3,
            BookingStatus.completed,
            answers={"text_to_write": "Ya Rahman", "size": "A2"},
            note="Crated and couriered to Hyderabad.",
        ),
        BookingRow(
            "lakshmi-3",
            "Custom Portrait Painting",
            _IMRAN,
            +20,
            0,
            BookingStatus.confirmed,
            answers={"text_to_write": "Imran and his daughters", "size": "A3"},
            note="Progress photographs each week, as listed.",
        ),
    ],
}


class ReviewRow(NamedTuple):
    """One review of a completed booking, by its tag. `reply` is the artist's answer and `reported` the reason the
    artist reported the review — both leave it public but waiting for a moderator, exactly as the app writes them.
    A text carrying a phone number, an email or a link is hidden by the same filter instead."""

    tag: str
    rating: int
    text: str | None = None
    reply: str | None = None
    reported: str | None = None


REVIEWS: list[ReviewRow] = [
    ReviewRow(
        "priya-1",
        5,
        "Two full hours on my hands and legs and she never once looked at her phone. The design was the one I saved.",
        reply="Thank you Ananya — the peacock panel was my favourite too.",
    ),
    ReviewRow(
        "priya-3", 5, "She did my sister and five of her guests in one afternoon and every design was different."
    ),
    ReviewRow(
        "priya-4",
        4,
        "Beautiful work, though she arrived forty minutes late. The colour was deep by the next morning.",
        reply="Sorry about that — I was stuck behind a baraat. I've pushed my start times back since.",
    ),
    ReviewRow("priya-5", 4, "Calm, clean work and a fresh cone; the design lasted three days at my engagement."),
    ReviewRow(
        "sneha-1",
        5,
        "My whole wedding morning — base, eyes, lashes, a touch-up kit — and the photographs came out as I'd hoped.",
        reply="That red dupatta was the easiest look to shoot. Congratulations!",
    ),
    ReviewRow("sneha-2", 5, "Three of us ready for a sangeet in two hours, and none of it moved in the heat."),
    ReviewRow(
        "sneha-3", 5, "The second session was worth every rupee: she changed my look completely in forty minutes."
    ),
    ReviewRow(
        "sneha-4", 4, "Very good hijab drape for my sister's nikah, though she was short on time and skipped the brows."
    ),
    ReviewRow("sneha-5", 5, "Fast, calm and not over-perfumed, which is exactly what I want for a daytime party."),
    ReviewRow(
        "aisha-1",
        5,
        "Hair and makeup together meant one less vendor to chase on the day, and nothing moved all evening.",
    ),
    ReviewRow(
        "aisha-2", 4, "Talented with bridal designs, but I asked for a lighter mehendi shade and got the dark one."
    ),
    ReviewRow(
        "aisha-3", 4, "She came to the venue with an assistant and did my sister and me. Punctual and fairly priced."
    ),
    ReviewRow(
        "aisha-4",
        3,
        "The mehendi was pretty but she started two hours late and my mother's design was rushed.",
        reply="I'm sorry — the job before yours ran over. I keep a free hour between weddings now.",
    ),
    # A phone number in the text is caught by the app's own filter, so this one lands hidden and waiting for a
    # moderator, exactly like a real review that tries to move the deal off-platform.
    ReviewRow(
        "aisha-6", 2, "Ordered favours for a wedding and they arrived two days after it. Ask her directly: 98450 67890"
    ),
    ReviewRow(
        "rahul-1", 5, "The whole day, both families, the drone and all — 300 edited photographs in under a month."
    ),
    ReviewRow(
        "rahul-2",
        3,
        "Half the family frames I asked for are missing and the album came a week late.",
        reply="I've spoken to my editor; the missing frames are being recoloured this week.",
        reported="None of this is true — the album was delivered the day we promised.",
    ),
    ReviewRow(
        "rahul-3", 5, "He found light on a grey Mumbai afternoon. The pre-wedding album is what we show people first."
    ),
    ReviewRow("rahul-4", 4, "Lovely photographs of the aqiqah, though he was one of the last to arrive."),
    ReviewRow("rahul-5", 5, "A newborn shoot at our home, patient and unhurried, and the retouching looks natural."),
    ReviewRow("ayesha-1", 5, "Bold Arabic trails, exactly the pattern I sent her. Held up through the whole evening."),
    ReviewRow("ayesha-2", 5, "Four of us done in an hour and a half, and the outline is still there after two washes."),
    ReviewRow(
        "ayesha-3",
        5,
        "Eleven years shows: she planned the bridal design around the jewellery, not around her own hand.",
        reply="The necklace decided everything — that's how bridal mehendi should work.",
    ),
    ReviewRow("ayesha-4", 3, "Good hands, but she brought one cone and it ran out halfway through."),
    ReviewRow("qalam-1", 5, "She wrote both names live at the reception and the hall watched without one mistake."),
    ReviewRow("qalam-2", 5, "The mehndi-night panels are framed in our living room now."),
    ReviewRow(
        "hiba-1", 5, "Twenty-five boxes printed with the baby's name and delivered before lunch. The dates were fresh."
    ),
    ReviewRow(
        "hiba-3", 4, "Nice packing and a good colour theme, though the name cards came blank and she reprinted them."
    ),
    ReviewRow("nidhi-1", 5, "Ten sets in gold foil with a proof before printing. My cousins got theirs by post."),
    ReviewRow("nidhi-2", 5, "The wax seals on fifty invites took her a week and every one landed straight."),
    ReviewRow(
        "sana-1",
        4,
        "The varmale block is beautiful. The LED base is dimmer than her photograph suggests.",
        reply="The new bases are brighter — I've switched supplier.",
    ),
    ReviewRow(
        "sana-2", 4, "A clean nameplate, well packed, but it took twelve days instead of the seven I was quoted."
    ),
    ReviewRow(
        "lakshmi-1", 5, "Twelve years of practice is on the canvas, and she sent progress photographs every third day."
    ),
    ReviewRow(
        "lakshmi-2", 4, "The gold leaf on the wall piece is superb; the crate took two weeks longer than promised."
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


def _code(prefix: str, tag: str) -> str:
    """A code out of a seed tag: six characters of the app's own alphabet, so a row keeps its code across runs.

    `booking.utils.new_code()` is random, and a random code makes an existence probe miss its own rows — every rerun
    would add a second copy of the whole dataset.
    """
    digest = blake2b(tag.encode(), digest_size=3).digest()
    return f"{prefix}-" + "".join(CODE_ALPHABET[byte % len(CODE_ALPHABET)] for byte in digest)


def _day_off(today: date, day_of_month: int) -> date:
    """One of an artist's days off: a day of *next* month, so the same run names the same date and a rerun a week
    later adds nothing (an offset from today would leave yesterday's day off behind and take another one)."""
    return shift_month(today.replace(day=1), 1).replace(day=day_of_month)


def _day(today: date, offset: int) -> date:
    """A booking's day: `offset` days from the seeder's date, negative for work already done."""
    return today + timedelta(days=offset)


def _start(
    tag: str,
    wanted: date,
    week: tuple[Day, ...],
    off: frozenset[date],
    duration: int,
    slot: int,
    ahead: bool,
) -> datetime:
    """The artist's `slot`th offered start on the wanted day. A closed weekday or a day off steps the day aside —
    back for a job already done, forward for an upcoming one — so a seeded time is always one the app would have put
    on the grid, whatever date the seeder runs on."""
    step = 1 if ahead else -1
    for i in range(8):
        day = wanted + timedelta(days=step * i)
        hours = week[day.weekday()]
        if not hours.is_open or day in off:
            continue
        starts = rules.slot_starts(day, (hours.open_hour, hours.close_hour), duration)
        if starts:
            return starts[slot % len(starts)]
    raise ValueError(f"{tag}: {wanted.isoformat()} isn't a working day within a week for this artist")


def _profiles(by_phone: dict[str, tuple[User, ArtistProfile]]) -> dict[str, ArtistProfile]:
    """business → profile, from the map `seed_artists` fills."""
    return {business: by_phone[phone][1] for phone, _first, _last, business, *_ in ARTISTS}


async def seed_schedule(session, now: datetime, profiles: dict[str, ArtistProfile]) -> int:
    """Weekly hours and days off, so the availability chips, the slot grid and `free_on` have a week to read.

    Every weekday gets a row, closed ones included, the way the artist's own schedule screen saves them: a missing
    row means the platform default (open 08:00-20:00), and then all twelve artists look identical.
    """
    today = rules.ist_today(now)
    added = 0
    for business, week in ARTIST_WEEK.items():
        artist_id = profiles[business].id
        for weekday, hours in enumerate(week):
            if await session.get(ArtistWorkingHour, (artist_id, weekday)) is None:
                session.add(
                    ArtistWorkingHour(
                        artist_id=artist_id,
                        weekday=weekday,
                        is_open=hours.is_open,
                        open_hour=hours.open_hour,
                        close_hour=hours.close_hour,
                    )
                )
                added += 1
    for business, days in DAYS_OFF.items():
        artist_id = profiles[business].id
        for day_of_month in days:
            off = _day_off(today, day_of_month)
            if await session.get(ArtistDayOff, (artist_id, off)) is None:
                session.add(ArtistDayOff(artist_id=artist_id, day_date=off))
                added += 1
    await session.flush()
    return added


async def _services(session, profiles: dict[str, ArtistProfile]) -> dict[tuple[str, str], ArtistServiceItem]:
    """(business, service name) → the listed service. Reading an item eager-loads its add-ons and its template, so
    `display_name` and `addons` are both safe here."""
    business_of = {profile.id: business for business, profile in profiles.items()}
    items = (await session.execute(select(ArtistServiceItem))).scalars()
    return {(business_of[item.artist_id], item.display_name): item for item in items if item.artist_id in business_of}


def _picks(row: BookingRow, item: ArtistServiceItem) -> list[BookingAddonIn]:
    """The booking's add-ons, matched on one word of the artist's own name for them, to keep the rows short."""
    picks = []
    for word, guests in row.extras:
        matches = [addon for addon in item.addons if word.lower() in addon.name.lower()]
        if len(matches) != 1:
            raise ValueError(f"{row.tag}: “{word}” matches {len(matches)} of {item.display_name}'s add-ons")
        picks.append(BookingAddonIn(addon_id=matches[0].id, guests=guests))
    return picks


def _answer_the_ask(row: BookingRow, booking: Booking, now: datetime) -> None:
    """The timestamps the matching transition would have set, in the order it sets them.

    The ask came in about a week before the job (or a day before whatever ended it), the artist answered inside the
    window, and the booking then ran its course. A `requested` row is left exactly as `new_booking` wrote it: still
    waiting for an answer.
    """
    booking.status = row.status
    if row.status is BookingStatus.requested:
        return
    outcome: datetime | None = {
        BookingStatus.completed: booking.end_at + timedelta(hours=2),
        BookingStatus.confirmed: None,
        BookingStatus.declined: min(booking.start_at - timedelta(days=3), now - timedelta(hours=6)),
        BookingStatus.cancelled: min(booking.start_at - timedelta(days=2), now - timedelta(days=1)),
    }[row.status]
    asked = min(booking.start_at - timedelta(days=7), (outcome or now) - timedelta(days=1))
    booking.expires_at = rules.accept_deadline(asked, booking.start_at)
    booking.responded_at = min(asked + timedelta(hours=2), booking.expires_at)
    if outcome is None:
        return
    if outcome > now:
        raise ValueError(f"{row.tag}: a {row.status.value} booking at day {row.day} finishes after the seeder's clock")
    if row.status is BookingStatus.completed:
        booking.completed_at = outcome
    elif row.status is BookingStatus.declined:
        booking.decline_reason = clean_reason(row.reason)
        booking.refund_due = True if booking.deposit_paise else None
    else:
        refund = rules.customer_refund_due(booking.start_at, outcome)
        booking_service.mark_cancelled(booking, outcome, "customer", row.reason, refund)


def _check_slots(made: dict[str, Booking]) -> None:
    """No artist double-booked. `ex_booking_no_overlap` refuses it in the database, so a clash here would fail the
    commit with a message no one would think to trace back to two seed literals that landed on the same afternoon."""
    held = [b for b in made.values() if b.status in (BookingStatus.requested, BookingStatus.confirmed)]
    for position, first in enumerate(held):
        for other in held[position + 1 :]:
            if first.artist_id == other.artist_id and first.start_at < other.end_at and other.start_at < first.end_at:
                raise ValueError(f"{first.code} and {other.code} hold the same artist slot")


async def seed_bookings(
    session, now: datetime, users: dict[str, User], profiles: dict[str, ArtistProfile]
) -> tuple[dict[str, Booking], int]:
    """Demo bookings in every status the screens list, written the way the app writes them: money by
    `booking.rules.price`, times by the artist's slot grid, answers by the category's own fields, each status with
    the timestamps its transition sets. Returns them by tag, which is how the reviews find their booking."""
    settings = get_booking_settings()
    services = await _services(session, profiles)
    today = rules.ist_today(now)
    made: dict[str, Booking] = {}
    added = 0
    for business, rows in BOOKINGS.items():
        artist = profiles[business]
        week = ARTIST_WEEK[business]
        off = frozenset(_day_off(today, day_of_month) for day_of_month in DAYS_OFF.get(business, ()))
        for row in rows:
            code = _code("BK", row.tag)
            booking = (await session.execute(select(Booking).where(Booking.code == code))).scalar_one_or_none()
            if booking is not None:
                # A request waits only `booking_accept_hours`, so a seeded ask would read back expired on the next
                # day's run and drop off the artist's list. Re-stamp ours, and only while it still waits.
                if booking.status is BookingStatus.requested:
                    booking.expires_at = rules.accept_deadline(now, booking.start_at)
                made[row.tag] = booking
                continue
            item = services.get((business, row.service))
            if item is None:
                raise ValueError(f"{row.tag}: {business} doesn't list “{row.service}”")
            service_rules = await catalog_fields.rules_for(session, item.category_id)
            if service_rules.fulfilment is catalog_fields.Fulfilment.made_to_order and row.status in (
                BookingStatus.requested,
                BookingStatus.declined,
            ):
                raise ValueError(f"{row.tag}: a made_to_order service is quoted, not requested")
            if row.guests != 1 and item.pricing_unit != PricingUnit.per_person:
                raise ValueError(f"{row.tag}: “{row.service}” is priced as a package, not per person")
            fields = service_rules.scoped(catalog_fields.FieldScope.booking)
            answers = catalog_fields.validate_values(fields, row.answers)
            lines = booking_service.addon_lines(item, _picks(row, item))
            start = _start(row.tag, _day(today, row.day), week, off, item.duration_minutes, row.slot, row.day >= 0)
            booking = booking_service.new_booking(
                settings,
                now,
                booking_service.NewBooking(
                    customer_id=users[row.customer].id,
                    artist_id=artist.id,
                    service_id=item.id,
                    service_name=item.display_name,
                    duration_minutes=item.duration_minutes,
                    start_at=start,
                    address=row.place or _ADDRESS_BY_PHONE[row.customer],
                    note=row.note,
                    price_paise=item.price_paise * row.guests + sum(line.line_paise for line in lines),
                    addons=lines,
                    quantity=row.guests,
                    answers=tuple(catalog_fields.answer_snapshot(fields, answers)),
                ),
            )
            booking.code = code
            _answer_the_ask(row, booking, now)
            session.add(booking)
            made[row.tag] = booking
            added += 1
    await session.flush()
    _check_slots(made)
    return made, added


async def _check_ratings(session) -> None:
    """Per artist, the public stars must average an exact one decimal — see `seed_reviews`."""
    rows = (
        await session.execute(
            select(ArtistProfile.business_name, func.sum(Review.rating), func.count())
            .select_from(Review)
            .join(ArtistProfile, ArtistProfile.id == Review.artist_id)
            .where(Review.status.in_(PUBLIC_REVIEW))
            .group_by(ArtistProfile.business_name)
        )
    ).all()
    for business, stars, count in rows:
        total = int(stars or 0)
        if count and (10 * total) % count:
            raise ValueError(f"{business}: {total} stars over {count} reviews isn't an exact one-decimal average")


async def seed_reviews(session, now: datetime, made: dict[str, Booking]) -> int:
    """Reviews of the completed bookings, a handful of artist replies, and the two a moderator has yet to settle.

    The rating a customer sees is worked out twice: the directory rounds `avg(rating)` in SQL, which always rounds
    half up, and the artist dashboard rounds it in Python, which rounds half to even. The star sums here are chosen
    to land on an exact one decimal, where both agree; `_check_ratings` is what keeps them that way.

    The rest follows the app's own writes: the text goes through the review filter, so the one carrying a phone
    number lands hidden for moderation, and the one the artist reported stays public but flagged, still counted.
    """
    added = 0
    for row in REVIEWS:
        booking = made.get(row.tag)
        if booking is None:
            raise ValueError(f"{row.tag}: no seeded booking by that tag to review")
        if booking.completed_at is None:
            raise ValueError(f"{row.tag}: only a completed booking gets reviewed")
        if (await session.execute(select(Review.id).where(Review.booking_id == booking.id))).first() is not None:
            continue
        flag = review_flag(row.text)
        status = ReviewStatus.flagged if row.reported else ReviewStatus.hidden if flag else ReviewStatus.published
        reviewed_at = min(booking.completed_at + timedelta(days=2), now - timedelta(hours=6))
        session.add(
            Review(
                booking_id=booking.id,
                artist_id=booking.artist_id,
                customer_id=booking.customer_id,
                rating=row.rating,
                text=row.text,
                status=status,
                flag="artist_report" if row.reported else flag,
                report_reason=row.reported,
                reply=row.reply,
                replied_at=(
                    min(reviewed_at + timedelta(days=1, hours=4), now - timedelta(hours=2)) if row.reply else None
                ),
                created_at=reviewed_at,
            )
        )
        added += 1
    await session.flush()
    await _check_ratings(session)
    return added


def _now() -> datetime:
    return datetime.now(UTC)


async def main() -> None:
    now = _now()
    async with SessionLocal() as session:
        images = seed_images()
        cats = await seed_catalog(session)
        users: dict[str, User] = {}
        await seed_user(session, ADMIN_PHONE, "Ops", "Admin", [UserRole.admin], None)
        for phone, first, last, roles, active in CUSTOMERS:
            users[phone] = await seed_user(session, phone, first, last, roles, active)
        for phone, first, last, *_rest in ARTISTS:
            users[phone] = await seed_user(session, phone, first, last, [UserRole.artist], UserRole.artist)
        by_phone: dict[str, tuple[User, ArtistProfile]] = {}
        await seed_artists(session, cats, by_phone)
        await seed_addresses(session)
        profiles = _profiles(by_phone)
        schedule = await seed_schedule(session, now, profiles)
        made, bookings = await seed_bookings(session, now, users, profiles)
        reviews = await seed_reviews(session, now, made)
        await session.commit()
    await engine.dispose()
    subs = sum(len(c[2]) for c in CATALOG)
    templates = sum(len(t) for c in CATALOG for _n, _s, t in c[2])
    approved = sum(1 for a in ARTISTS if a[8] is ArtistStatus.approved)
    planned = sum(len(rows) for rows in BOOKINGS.values())
    print(
        f"Seeded: catalog ({len(CATALOG)} categories, {subs} subcategories, {templates} service templates), 1 admin, "
        f"{len(CUSTOMERS)} customers, {len(ARTISTS)} artists ({approved} approved, {len(ARTISTS) - approved} pending) "
        f"with services/addons/portfolio, {planned} bookings, {len(REVIEWS)} reviews, working hours and days off."
    )
    print(f"New rows this run: {images} uploads, {schedule} schedule, {bookings} bookings, {reviews} reviews.")


if __name__ == "__main__":
    asyncio.run(main())
