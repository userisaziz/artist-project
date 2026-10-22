"""Profile requirements: admin settings, an artist's to-do list, admin reminders and the automatic notices."""

import uuid
from datetime import datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.artist.models import ArtistProfile
from app.core.exceptions import ConflictError, NotFoundError
from app.notification import service as notification_service
from app.requirement.constants import DEFAULT_GRACE_DAYS, REQUIREMENTS, Requirement, Stage
from app.requirement.models import RequirementNotice, RequirementSetting
from app.requirement.repository import RequirementRepository
from app.requirement.schemas import RequirementSettingIn
from app.requirement.utils import is_missing
from app.shared.clock import Clock
from app.shared.enums import ArtistStatus
from app.user.models import User


def due_at(setting: RequirementSetting) -> datetime | None:
    if not setting.mandatory or setting.effective_from is None:
        return None
    return setting.effective_from + timedelta(days=setting.grace_days)


async def is_on_hold(session: AsyncSession, artist_id: uuid.UUID) -> bool:
    """For other domains: an approved artist hidden for an overdue requirement takes no new bookings or enquiries."""
    return await RequirementRepository(session).is_on_hold(artist_id)


async def missing_mandatory(session: AsyncSession, profiles: list[ArtistProfile]) -> dict[uuid.UUID, list[str]]:
    """artist id → keys of mandatory requirements that artist hasn't met (any stage), for admin lists."""
    settings = await RequirementRepository(session).settings()
    mandatory = [REQUIREMENTS[k] for k, s in settings.items() if s.mandatory and k in REQUIREMENTS]
    return {p.id: [r.key for r in mandatory if is_missing(r, p)] for p in profiles}


class RequirementService:
    def __init__(self, session: AsyncSession, clock: Clock):
        self.session = session
        self.repo = RequirementRepository(session)
        self.clock = clock

    async def _settings(self) -> dict[str, RequirementSetting]:
        """Every registered requirement's setting, adding default (optional) rows for any new one."""
        rows = await self.repo.settings()
        for key in REQUIREMENTS.keys() - rows.keys():
            rows[key] = RequirementSetting(key=key, mandatory=False, grace_days=DEFAULT_GRACE_DAYS)
            self.repo.add(rows[key])
        await self.session.flush()
        return {k: rows[k] for k in REQUIREMENTS}

    @staticmethod
    def _setting_out(setting: RequirementSetting) -> dict:
        r = REQUIREMENTS[setting.key]
        return {
            "key": r.key,
            "title": r.title,
            "body": r.body,
            "mandatory": setting.mandatory,
            "grace_days": setting.grace_days,
            "effective_from": setting.effective_from,
        }

    async def settings(self) -> list[dict]:
        return [self._setting_out(s) for s in (await self._settings()).values()]

    async def update(self, key: str, body: RequirementSettingIn) -> dict:
        setting = (await self._settings()).get(key)
        if setting is None:
            raise NotFoundError("Requirement not found")
        if body.mandatory and not setting.mandatory:
            setting.effective_from = self.clock.now()  # the grace period starts now
        if not body.mandatory:
            setting.effective_from = None
        setting.mandatory = body.mandatory
        setting.grace_days = body.grace_days
        await self.session.flush()
        return self._setting_out(setting)

    def _pending(self, profile: ArtistProfile, settings: dict[str, RequirementSetting]) -> list[dict]:
        now = self.clock.now()
        items = []
        for key, setting in settings.items():
            deadline = due_at(setting)
            requirement = REQUIREMENTS[key]
            if deadline is None or not is_missing(requirement, profile):
                continue
            items.append(
                {
                    "key": key,
                    "title": requirement.title,
                    "body": requirement.body,
                    "action": requirement.action,
                    "due_at": deadline,
                    "overdue": deadline <= now,
                }
            )
        return items

    async def mine(self, user: User) -> dict:
        profile = await self.repo.profile_by_user(user.id)
        if profile is None:
            raise NotFoundError("Artist profile not found")
        items = self._pending(profile, await self._settings())
        held = profile.status == ArtistStatus.approved and any(i["overdue"] for i in items)
        return {"on_hold": held, "items": items}

    async def _listed(self, artist_id: uuid.UUID) -> ArtistProfile:
        profile = await self.repo.profile(artist_id)
        if profile is None or profile.status == ArtistStatus.draft:
            raise NotFoundError("Artist not found")
        return profile

    async def for_artist(self, artist_id: uuid.UUID) -> dict:
        """An admin's view of one artist's to-do list (same shape as the artist's own)."""
        profile = await self._listed(artist_id)
        items = self._pending(profile, await self._settings())
        held = profile.status == ArtistStatus.approved and any(i["overdue"] for i in items)
        return {"on_hold": held, "items": items}

    async def remind(self, artist_id: uuid.UUID) -> None:
        profile = await self._listed(artist_id)
        items = self._pending(profile, await self._settings())
        if not items:
            raise ConflictError("This artist has nothing left to complete")
        first = items[0]
        await notification_service.notify_artist(
            self.session, profile.id, "requirement_reminder", first["title"], first["body"], first["action"]
        )

    async def send_notices(self) -> dict[Stage, int]:
        """Warning while in the grace period, then "on hold" once it ends: each sent once per artist."""
        sent: dict[Stage, int] = {"requirement_due": 0, "requirement_on_hold": 0}
        now = self.clock.now()
        for key, setting in (await self._settings()).items():
            deadline = due_at(setting)
            if deadline is None:
                continue
            stage: Stage = "requirement_on_hold" if deadline <= now else "requirement_due"
            requirement = REQUIREMENTS[key]
            for artist_id in await self.repo.unnoticed(requirement, stage):
                await self._notice(artist_id, requirement, stage, deadline)
                sent[stage] += 1
        await self.session.flush()
        return sent

    async def _notice(self, artist_id: uuid.UUID, requirement: Requirement, stage: Stage, deadline: datetime) -> None:
        if stage == "requirement_on_hold":
            title, body = "Your profile is hidden", f"{requirement.title} to show up for clients again."
        else:
            title, body = requirement.title, f"{requirement.body} Please complete it by {deadline:%d %b}."
        self.repo.add(
            RequirementNotice(artist_id=artist_id, key=requirement.key, stage=stage, sent_at=self.clock.now())
        )
        await notification_service.notify_artist(self.session, artist_id, stage, title, body, requirement.action)
