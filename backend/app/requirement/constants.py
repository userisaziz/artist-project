"""Profile requirements artists can be asked to meet after approval. Each one lives in code (what it checks and
which screen fixes it); whether it is mandatory, and the grace period, are admin settings (requirement_setting)."""

from dataclasses import dataclass
from typing import Literal

DEFAULT_GRACE_DAYS = 7
MIN_GRACE_DAYS = 0
MAX_GRACE_DAYS = 90

# Refusal for a new booking or enquiry to an artist on hold.
NOT_TAKING_REQUESTS = "This artist isn\u2019t taking new requests right now."

Stage = Literal["requirement_due", "requirement_on_hold"]  # automatic notices, each sent once per artist


@dataclass(frozen=True)
class Requirement:
    key: str
    title: str  # the artist's to-do, e.g. on the app's warning strip
    body: str
    action: str  # the artist-app screen that completes it


LOCATION = Requirement(
    key="location",
    title="Add your studio location",
    body="Clients nearby can only find you once your area and pincode are on your profile.",
    action="/artist/location",
)

EXPERIENCE = Requirement(
    key="experience",
    title="Add your years of experience",
    body="Clients compare artists by experience; it shows on your storefront.",
    action="/artist/details",
)

LANGUAGES = Requirement(
    key="languages",
    title="Add the languages you speak",
    body="Clients look for an artist they can talk to; your languages show on your storefront.",
    action="/artist/details",
)

REQUIREMENTS: dict[str, Requirement] = {r.key: r for r in (LOCATION, EXPERIENCE, LANGUAGES)}
