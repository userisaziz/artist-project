"""SQL rules for requirements, shared by every query that shows artists publicly or takes new bookings.

On hold is computed, never stored: an approved artist missing a mandatory requirement whose grace period has
ended. Completing it lifts the hold at once, and an admin suspension (a real status) is never touched."""

from sqlalchemy import ColumnElement, and_, exists, false, func, not_, or_, select

from app.artist.models import ArtistProfile
from app.requirement.constants import LOCATION, REQUIREMENTS, Requirement
from app.requirement.models import RequirementSetting
from app.shared.enums import ArtistStatus


def missing(requirement: Requirement) -> ColumnElement[bool]:
    """True when the artist hasn't met `requirement`."""
    if requirement.key == LOCATION.key:  # an area picked from the catalog (older free-text areas don't count)
        return or_(ArtistProfile.area_id.is_(None), ArtistProfile.pincode.is_(None))
    raise ValueError(f"No check for requirement {requirement.key!r}")  # every registered requirement needs one


def is_missing(requirement: Requirement, profile: ArtistProfile) -> bool:
    if requirement.key == LOCATION.key:
        return profile.area_id is None or not profile.pincode
    raise ValueError(f"No check for requirement {requirement.key!r}")


def _overdue(key: str) -> ColumnElement[bool]:
    """The requirement is mandatory and its grace period has ended (database clock)."""
    s = RequirementSetting
    deadline = s.effective_from + func.make_interval(0, 0, 0, s.grace_days)
    return exists(select(s.key).where(s.key == key, s.mandatory.is_(True), deadline <= func.now()))


def on_hold() -> ColumnElement[bool]:
    held = [and_(missing(r), _overdue(r.key)) for r in REQUIREMENTS.values()]
    return and_(ArtistProfile.status == ArtistStatus.approved, or_(*held) if held else false())


def publicly_visible() -> ColumnElement[bool]:
    """Approved and not on hold: who customers can find, follow, buy from and send new requests to."""
    return and_(ArtistProfile.status == ArtistStatus.approved, not_(on_hold()))
