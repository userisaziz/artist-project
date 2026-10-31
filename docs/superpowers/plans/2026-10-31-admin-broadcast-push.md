# Admin Broadcast Push Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admins compose a push announcement in the console (segment + filters), see its exact audience, confirm, and send — one inbox row per recipient, one Expo push per device, one immutable history row.

**Architecture:** A new `notification_broadcast` table records every send; recipient resolution is one reusable set-based query shared by preview and send; inbox rows are inserted with a single `INSERT ... SELECT` (same shape as `notify_admins`); pushes are queued on the session and delivered after commit by the existing `ExpoPushProvider`, which this plan also fixes to chunk at Expo's 100-message-per-request cap. Admin UI is one new feature folder wired into the existing console shell.

**Tech Stack:** FastAPI + SQLAlchemy 2 async + Alembic (backend); React 19 + TanStack Query + shadcn/ui + vitest (admin); Expo React Native (mobile, one line).

**Spec:** `docs/superpowers/specs/2026-10-31-admin-broadcast-push-design.md`

---

## Codebase facts the implementer needs

- **Backend layout**: feature modules under `backend/app/<domain>/` — `models.py`, `schemas.py`, `service.py`, `router.py`, and `admin_router.py` for admin-only endpoints. Admin routers are mounted in `app/router.py` (imports at top, `api_router.include_router(...)` below). Errors: raise `app.core.exceptions.AppError` subclasses (`ValidationError` = 422, code `validation_error`); the app maps them to `{code, message}`.
- **Tests**: real Postgres; conftest (`backend/tests/conftest.py`) applies migrations to head at session start, truncates every table after each test, and overrides `get_db`. Support helpers in `backend/tests/support/` (`auth.sign_in`, `auth.admin_headers`, `catalog.seed_categories`, `catalog.categories`, `artist.approved_artist`, `artist.complete_profile`). Push provider is `console` in tests — `ConsolePushProvider.sent` records messages; clear it in an autouse fixture. Run from `backend/`: `.venv/bin/pytest tests/<file> -x -q`.
- **Lint gates (Husky, errors block)**: backend `.venv/bin/ruff check . && .venv/bin/ruff format --check .`; admin `cd admin && npm run lint && npm run lint:arch`; mobile `cd mobile && npm run lint`. Admin tests: `cd admin && npm run test -- <path-filter>`. Typecheck admin: `npm run typecheck`.
- **Commits**: Conventional Commits on `main`; stage explicit paths only (never `git add .` — unrelated WIP gets swept in); check `git diff --cached --name-status` before each commit.
- **Admin console conventions**: routes in `app/routes.tsx`, lazy chunks in `app/page-chunks.ts`, `PATHS` in `lib/paths.ts`, sidebar in `app/layout/nav-items.ts`; pages use `PageHeader`, `Panel`, `PanelFooter`, `GridMessage` (`@/components/…`, `@/components/console/…`); data in a feature `queries.ts` via `api()` from `@/lib/api` (auto-prefixes `API_URL`, throws `ApiError`); tests use `renderSignedIn(path)` + `installFakeBackend()` (`@/test/…`).

## File structure

| Action | Path | Responsibility |
| --- | --- | --- |
| Modify | `backend/app/notification/constants.py` | add `"announcement"` to `Kind`, `ANNOUNCEMENT` constant |
| Modify | `backend/app/notification/models.py` | add `NotificationBroadcast` model |
| Create | `backend/alembic/versions/2026-10-31_notification_broadcasts.py` | one table + one index |
| Modify | `backend/app/notification/push.py` | chunk `_send` at 100 messages |
| Modify | `backend/app/notification/schemas.py` | broadcast request/response schemas |
| Create | `backend/app/notification/broadcast.py` | audience query + preview/send (history lands in Task 4) |
| Create | `backend/app/notification/admin_router.py` | 3 guarded endpoints |
| Modify | `backend/app/router.py` | mount the admin router |
| Modify | `backend/tests/test_notifications.py` | chunking test |
| Create | `backend/tests/test_broadcasts.py` | audience/preview/send/history tests |
| Modify | `admin/src/test/fake-backend.ts` | `/cities`, preview/send/history routes |
| Create | `admin/src/features/broadcasts/types.ts` | admin-side contracts |
| Create | `admin/src/features/broadcasts/queries.ts` | list/preview/send/cities hooks |
| Create | `admin/src/features/broadcasts/BroadcastsPage.tsx` | composer + confirm + history |
| Create | `admin/src/features/broadcasts/broadcasts.test.tsx` | vitest flows |
| Modify | `admin/src/lib/paths.ts`, `app/routes.tsx`, `app/page-chunks.ts`, `app/layout/nav-items.ts` | wiring |
| Modify | `mobile/src/types/notifications/notifications.ts` | add `'announcement'` |

---

### Task 1: `notification_broadcast` model, `announcement` kind, migration

**Files:**
- Modify: `backend/app/notification/constants.py`
- Modify: `backend/app/notification/models.py`
- Create: `backend/alembic/versions/2026-10-31_notification_broadcasts.py`

- [ ] **Step 1: Add the kind and its service constant** — in `backend/app/notification/constants.py`, append one entry to the `Kind` literal after `"subcategory_suggested"` and one constant after the literal:

```python
Kind = Literal[
    "booking_requested",
    # … unchanged …
    # admin console
    "artist_submitted",
    "ticket_opened",
    "post_reported",
    "subcategory_suggested",
    # admin broadcast
    "announcement",
]
TITLE_MAX = 120
BODY_MAX = 300
LINK_MAX = 200
TOKEN_MAX = 200
PENDING_PUSH = "pending_push"  # session.info key: pushes to send once the transaction commits
ANNOUNCEMENT: Kind = "announcement"
```

- [ ] **Step 2: Add the model** — in `backend/app/notification/models.py`, extend the imports (add `Integer` to the `sqlalchemy` import; add `JSONB` to the `sqlalchemy.dialects.postgresql` import) and append the class after `PushDevice`:

```python
class NotificationBroadcast(Base, TimestampMixin):
    """One admin broadcast: what was sent, to whom (segment + filter snapshot), and the resulting counts.
    Immutable: no edits or deletes — the history table plus the admin.action audit is the trail."""

    __tablename__ = "notification_broadcast"
    __mapper_args__ = {"eager_defaults": True}  # fetch server defaults (id, timestamps) via RETURNING

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
    )
    title: Mapped[str] = mapped_column(String(TITLE_MAX), nullable=False)
    body: Mapped[str] = mapped_column(String(BODY_MAX), nullable=False)
    link: Mapped[str | None] = mapped_column(String(LINK_MAX))
    segment: Mapped[str] = mapped_column(String(20), nullable=False)  # all_users | all_artists | all_customers
    filters: Mapped[dict] = mapped_column(
        JSONB, nullable=False, default=dict, server_default=sa.text("'{}'")
    )
    recipient_count: Mapped[int] = mapped_column(Integer, nullable=False)
    push_count: Mapped[int] = mapped_column(Integer, nullable=False)  # recipients who had a device (people)
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("user_account.id", ondelete="SET NULL")
    )

    __table_args__ = (sa.Index("ix_notification_broadcast_created_at", "created_at", "id"),)
```

`models.py` already imports `TITLE_MAX, BODY_MAX, LINK_MAX` from constants — no change needed there.

- [ ] **Step 3: Create the migration** — `backend/alembic/versions/2026-10-31_notification_broadcasts.py` (head today is `9d4b7e2c1f85`; confirm with `.venv/bin/alembic heads` before writing):

```python
"""Admin broadcasts: an immutable record of every push announcement sent from the console.

Revision ID: c5a9d7e3f2b8
Revises: 9d4b7e2c1f85
Create Date: 2026-10-31
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "c5a9d7e3f2b8"
down_revision: str | Sequence[str] | None = "9d4b7e2c1f85"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

NOW = sa.text("now()")


def upgrade() -> None:
    op.create_table(
        "notification_broadcast",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("title", sa.String(120), nullable=False),
        sa.Column("body", sa.String(300), nullable=False),
        sa.Column("link", sa.String(200), nullable=True),
        sa.Column("segment", sa.String(20), nullable=False),
        sa.Column("filters", postgresql.JSONB, server_default=sa.text("'{}'"), nullable=False),
        sa.Column("recipient_count", sa.Integer(), nullable=False),
        sa.Column("push_count", sa.Integer(), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=NOW, nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=NOW, nullable=False),
        sa.ForeignKeyConstraint(
            ["created_by"],
            ["user_account.id"],
            name=op.f("fk_notification_broadcast_created_by_user_account"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_notification_broadcast")),
    )
    op.create_index("ix_notification_broadcast_created_at", "notification_broadcast", ["created_at", "id"])


def downgrade() -> None:
    op.drop_index("ix_notification_broadcast_created_at", table_name="notification_broadcast")
    op.drop_table("notification_broadcast")
```

The model is registered automatically: `app/registry.py` already imports `app.notification.models`.

- [ ] **Step 4: Verify migrations and models agree**

Run: `cd backend && .venv/bin/pytest tests/test_migrations.py -x -q`
Expected: all pass — `test_models_and_migrations_agree` proves the schema matches the models, the naming test proves constraint/index names, and conftest ran the new migration to head.

- [ ] **Step 5: Lint**

Run: `cd backend && .venv/bin/ruff check . && .venv/bin/ruff format --check .`
Expected: no errors (warnings ok).

- [ ] **Step 6: Commit**

```bash
git add backend/app/notification/constants.py backend/app/notification/models.py backend/alembic/versions/2026-10-31_notification_broadcasts.py
git commit -m "feat: add notification_broadcast table and announcement kind"
```

---

### Task 2: Chunk Expo pushes at 100 messages per request

**Files:**
- Modify: `backend/app/notification/push.py:73-89` (`_send`)
- Modify: `backend/tests/test_notifications.py` (append one test at the end)

- [ ] **Step 1: Write the failing test** — append to `backend/tests/test_notifications.py`:

```python
async def test_expo_provider_chunks_batches_over_100():
    batches: list[list[dict]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        batch = json.loads(request.content)
        batches.append(batch)
        return httpx.Response(200, json={"data": [{"status": "ok"} for _ in batch]})

    messages = [{"to": f"ExponentPushToken[{i}]", "title": "Hi", "body": "There", "data": {}} for i in range(250)]
    await ExpoPushProvider("https://push.test", 1, httpx.MockTransport(handler))._send(messages)

    assert [len(b) for b in batches] == [100, 100, 50]
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd backend && .venv/bin/pytest tests/test_notifications.py::test_expo_provider_chunks_batches_over_100 -x -q`
Expected: FAIL — `assert [250] == [100, 100, 50]` (the current `_send` posts everything in one request).

- [ ] **Step 3: Implement chunking** — replace the body of `_send` in `backend/app/notification/push.py` with:

```python
    async def _send(self, messages: list[PushMessage]) -> None:
        try:
            async with httpx.AsyncClient(timeout=self.timeout, transport=self.transport) as client:
                dead: list[str] = []
                for start in range(0, len(messages), 100):  # Expo caps requests at 100 messages
                    chunk = messages[start : start + 100]
                    response = await client.post(self.url, json=chunk)
                    if response.status_code >= 400:
                        logger.warning("Expo push failed (%s): %s", response.status_code, response.text[:300])
                        continue
                    dead.extend(unregistered_tokens(chunk, response.json()))
        except (httpx.HTTPError, ValueError) as exc:  # ValueError: a body that isn't JSON
            logger.warning("Expo push failed: %s", exc)
            return
        if dead:
            logger.info("Forgetting %d unregistered push token(s)", len(dead))
            try:
                await self.forget(dead)
            except SQLAlchemyError:  # the next push retries the cleanup
                logger.exception("Could not forget unregistered push tokens")
```

- [ ] **Step 4: Run the whole notification suite** (the existing single-message tests must stay green)

Run: `cd backend && .venv/bin/pytest tests/test_notifications.py -x -q`
Expected: all pass, including `test_expo_provider_posts_messages_and_survives_failures` and `test_tokens_expo_reports_unregistered_stop_getting_pushes`.

- [ ] **Step 5: Lint, then commit**

Run: `cd backend && .venv/bin/ruff check . && .venv/bin/ruff format --check .`

```bash
git add backend/app/notification/push.py backend/tests/test_notifications.py
git commit -m "fix: chunk Expo push sends into batches of 100"
```

---

### Task 3: Broadcast schemas, audience query, preview/send service

**Files:**
- Modify: `backend/app/notification/schemas.py`
- Create: `backend/app/notification/broadcast.py`
- Create: `backend/tests/test_broadcasts.py`

- [ ] **Step 1: Write the failing service tests** — create `backend/tests/test_broadcasts.py` with exactly this content (Task 4 appends endpoint tests to the same file):

```python
"""Admin broadcasts: segments + filters resolve the exact audience; an artist-only filter narrows
`all_users`/`all_customers` to artists; city/status/category/join-date filters behave as specified."""

from contextlib import asynccontextmanager
from datetime import UTC, datetime

import pytest_asyncio
import sqlalchemy as sa
from sqlalchemy import func, select

from app.notification.broadcast import recipient_query
from app.notification.push import ConsolePushProvider
from app.notification.schemas import BroadcastFilters
from tests.conftest import TestSessionFactory
from tests.support.artist import approved_artist, complete_profile
from tests.support.auth import admin_headers, sign_in
from tests.support.catalog import categories, seed_categories


@pytest_asyncio.fixture(autouse=True)
async def categories_seeded(engine):
    await seed_categories(engine)
    ConsolePushProvider.sent.clear()


@asynccontextmanager
async def db_session():
    async with TestSessionFactory() as session:
        yield session


async def audience_size(session, segment: str, **filters) -> int:
    query = recipient_query(segment, BroadcastFilters(**filters))
    return (await session.scalar(select(func.count()).select_from(query.subquery()))) or 0


async def test_segments_resolve_role_grants(client, engine):
    await admin_headers(client, engine)  # admin grant only: never a broadcast recipient
    await sign_in(client, "+919845070001")  # artist role
    await sign_in(client, "+919845080001", role="customer")

    async with db_session() as session:
        assert await audience_size(session, "all_users") == 2
        assert await audience_size(session, "all_artists") == 1
        assert await audience_size(session, "all_customers") == 1


async def test_artist_status_defaults_to_approved(client, engine):
    admin = await admin_headers(client, engine)
    await approved_artist(client, engine, "+919845070001", admin)
    pending = await sign_in(client, "+919845070002")
    await complete_profile(client, pending)
    await client.post("/api/v1/artists/me/submit", headers=pending)

    async with db_session() as session:
        assert await audience_size(session, "all_artists") == 1  # default: approved only
        assert await audience_size(session, "all_artists", artist_status="pending") == 1
        assert await audience_size(session, "all_artists", artist_status="draft") == 0


async def test_city_filter(client, engine):
    admin = await admin_headers(client, engine)
    await approved_artist(client, engine, "+919845070001", admin, city="Bangalore")
    await approved_artist(client, engine, "+919845070002", admin, city="Pune", name="Pune Henna Studio")

    async with db_session() as session:
        assert await audience_size(session, "all_artists", city="Bangalore") == 1
        assert await audience_size(session, "all_artists", city="Surat") == 0


async def test_category_filter_matches_the_chosen_category_or_its_subcategories(client, engine):
    admin = await admin_headers(client, engine)
    await approved_artist(client, engine, "+919845070001", admin)  # Bridal Classic under Mehendi › Bridal
    cats = await categories(client)
    async with engine.begin() as conn:
        bridal = await conn.scalar(sa.text("SELECT id FROM catalog_category WHERE slug = 'mehendi-bridal'"))

    async with db_session() as session:
        assert await audience_size(session, "all_artists", category_id=bridal) == 1
        assert await audience_size(session, "all_artists", category_id=cats["mehendi"]) == 1  # parent of Bridal
        assert await audience_size(session, "all_artists", category_id=cats["makeup"]) == 0


async def test_join_date_range_is_inclusive(client, engine):
    await admin_headers(client, engine)
    await sign_in(client, "+919845070001")  # every account here is created today
    today = datetime.now(UTC).date().isoformat()  # server timestamps are UTC

    async with db_session() as session:
        assert await audience_size(session, "all_artists", joined_from=today) == 1
        assert await audience_size(session, "all_artists", joined_to="2020-01-01") == 0
        assert await audience_size(session, "all_artists", joined_from="2020-01-01", joined_to=today) == 1


async def test_artist_only_filters_narrow_the_segment_to_artists(client, engine):
    admin = await admin_headers(client, engine)
    await approved_artist(client, engine, "+919845070001", admin)
    await sign_in(client, "+919845080001", role="customer")

    async with db_session() as session:
        # city silently narrows all_users to the artist holding it
        assert await audience_size(session, "all_users", city="Bangalore") == 1
        assert await audience_size(session, "all_customers", city="Bangalore") == 0
```

- [ ] **Step 2: Run to see it fail**

Run: `cd backend && .venv/bin/pytest tests/test_broadcasts.py -x -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.notification.broadcast'` (and `BroadcastFilters` doesn't exist yet).

- [ ] **Step 3: Add the schemas** — append to `backend/app/notification/schemas.py` (extend the imports at top to: `from datetime import date, datetime`, `from typing import Annotated, Literal`, `from pydantic import Field, StringConstraints, model_validator`, and `from app.notification.constants import BODY_MAX, LINK_MAX, TITLE_MAX, TOKEN_MAX`):

```python
class BroadcastFilters(APIModel):
    city: Annotated[str | None, StringConstraints(max_length=60)] = None
    artist_status: Literal["draft", "pending", "approved"] | None = None
    category_id: int | None = None
    joined_from: date | None = None
    joined_to: date | None = None

    @model_validator(mode="after")
    def range_is_valid(self):
        if self.joined_from and self.joined_to and self.joined_from > self.joined_to:
            raise ValueError("joined_from must be on or before joined_to")
        return self


class BroadcastPreviewIn(APIModel):
    segment: Literal["all_users", "all_artists", "all_customers"]
    filters: BroadcastFilters = Field(default_factory=BroadcastFilters)


class BroadcastPreviewOut(APIModel):
    recipients: int
    with_push: int


class BroadcastIn(BroadcastPreviewIn):
    title: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=TITLE_MAX)]
    body: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=BODY_MAX)]
    link: Annotated[str | None, StringConstraints(max_length=LINK_MAX, pattern=r"^/(?:[^/]|$)")] = None


class BroadcastSentOut(APIModel):
    id: uuid.UUID
    recipients: int
    with_push: int


class BroadcastOut(APIModel):
    id: uuid.UUID
    title: str
    body: str
    link: str | None
    segment: str
    filters: dict
    recipient_count: int
    push_count: int
    created_at: datetime


class BroadcastPage(APIModel):
    items: list[BroadcastOut]
    next_cursor: str | None
```

- [ ] **Step 4: Write the service** — create `backend/app/notification/broadcast.py`:

```python
"""Admin broadcasts: one audience query shared by preview and send; a send writes one inbox row per
recipient (kind `announcement`), queues a push per registered device, and records an immutable row.
The inbox row is the record; a lost push is acceptable, exactly like every other push in the app."""

from datetime import UTC, datetime, time, timedelta
from typing import TYPE_CHECKING, Any

from sqlalchemy import Select, String, exists, func, insert, literal, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.artist.models import ArtistProfile, ArtistServiceItem
from app.catalog.models import Category
from app.notification.constants import ANNOUNCEMENT, BODY_MAX, PENDING_PUSH, TITLE_MAX
from app.notification.models import Notification, NotificationBroadcast, PushDevice
from app.shared.enums import ArtistStatus, UserRole
from app.user.models import User, UserRoleGrant

if TYPE_CHECKING:
    from app.notification.schemas import BroadcastFilters, BroadcastIn

SEGMENT_ROLES: dict[str, tuple[UserRole, ...]] = {
    "all_users": (UserRole.customer, UserRole.artist),
    "all_artists": (UserRole.artist,),
    "all_customers": (UserRole.customer,),
}


def recipient_query(segment: str, f: "BroadcastFilters") -> Select:
    """The exact audience: active users holding the segment's role grant, one row per person.
    Artists pass only at the chosen profile status (`approved` by default); an artist who has not
    built a profile yet still counts. City / category filters join the profile, so any artist-only
    filter inherently narrows the segment to artists — combined with `all_customers` that
    predictably yields nobody."""
    roles = SEGMENT_ROLES[segment]
    status = ArtistStatus(f.artist_status) if f.artist_status else ArtistStatus.approved
    query = (
        select(User.id)
        .join(UserRoleGrant, UserRoleGrant.user_id == User.id)
        .where(User.is_active.is_(True), UserRoleGrant.role.in_(roles))
        .distinct()
    )
    if segment != "all_customers":
        query = query.outerjoin(ArtistProfile, ArtistProfile.user_id == User.id)
        if f.artist_status is None:
            query = query.where(or_(ArtistProfile.id.is_(None), ArtistProfile.status == status))
        else:
            query = query.where(ArtistProfile.status == status)
    if f.joined_from is not None:
        query = query.where(User.created_at >= datetime.combine(f.joined_from, time.min, tzinfo=UTC))
    if f.joined_to is not None:
        query = query.where(
            User.created_at < datetime.combine(f.joined_to + timedelta(days=1), time.min, tzinfo=UTC)
        )
    if f.artist_status is not None or f.city is not None or f.category_id is not None:
        if segment == "all_customers":
            # An artist-only filter on a customer segment: the inner join makes it predictably empty.
            query = query.join(ArtistProfile, ArtistProfile.user_id == User.id)
            query = query.where(ArtistProfile.status == status)
        if f.city is not None:
            query = query.where(ArtistProfile.city == f.city)
        if f.category_id is not None:
            # Service items point at subcategories; legacy rows point at a top-level category.
            # Matching the chosen id or any of its children covers both (two levels only).
            tree = or_(
                Category.id == f.category_id,
                Category.parent_id == f.category_id,
            )
            query = query.where(
                exists(
                    select(ArtistServiceItem.id)
                    .join(Category, Category.id == ArtistServiceItem.category_id)
                    .where(ArtistServiceItem.artist_id == ArtistProfile.id, tree)
                )
            )
    return query


async def _audience_counts(session: AsyncSession, segment: str, f: "BroadcastFilters") -> dict[str, int]:
    audience = recipient_query(segment, f)
    recipients = (await session.scalar(select(func.count()).select_from(audience.subquery()))) or 0
    with_push = (
        await session.scalar(
            select(func.count(func.distinct(PushDevice.user_id))).where(
                PushDevice.user_id.in_(audience.scalar_subquery())
            )
        )
    ) or 0
    return {"recipients": recipients, "with_push": with_push}


async def preview(session: AsyncSession, segment: str, f: "BroadcastFilters") -> dict[str, int]:
    """The exact numbers the send will produce — preview and send share this code path."""
    return await _audience_counts(session, segment, f)


async def send(session: AsyncSession, me: User, body: "BroadcastIn") -> dict[str, Any] | None:
    """Write the broadcast row, the inbox rows and the pending pushes; None when the audience is empty."""
    counts = await _audience_counts(session, body.segment, body.filters)
    if counts["recipients"] == 0:
        return None
    title, text, link = body.title[:TITLE_MAX], body.body[:BODY_MAX], body.link
    audience = recipient_query(body.segment, body.filters).subquery()
    broadcast = NotificationBroadcast(
        title=title,
        body=text,
        link=link,
        segment=body.segment,
        filters=body.filters.model_dump(exclude_none=True),
        recipient_count=counts["recipients"],
        push_count=counts["with_push"],
        created_by=me.id,
    )
    session.add(broadcast)
    columns = [Notification.user_id, Notification.kind, Notification.title, Notification.body, Notification.link]
    await session.execute(
        insert(Notification).from_select(
            columns,
            select(
                audience.c.id,
                literal(ANNOUNCEMENT, String),
                literal(title, String),
                literal(text, String),
                literal(link, String),
            ),
        )
    )
    tokens = (
        await session.scalars(select(PushDevice.token).where(PushDevice.user_id.in_(select(audience.c.id))))
    ).all()
    if tokens:
        pending = session.sync_session.info.setdefault(PENDING_PUSH, [])
        pending.extend(
            {"to": t, "title": title, "body": text, "data": {"kind": ANNOUNCEMENT, "link": link}} for t in tokens
        )
    await session.flush()  # eager_defaults: the generated id comes back via RETURNING
    return {"id": broadcast.id, **counts}
```

- [ ] **Step 5: Run the service tests**

Run: `cd backend && .venv/bin/pytest tests/test_broadcasts.py -x -q`
Expected: all 6 tests pass.

- [ ] **Step 6: Lint**

Run: `cd backend && .venv/bin/ruff check . && .venv/bin/ruff format --check .`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add backend/app/notification/schemas.py backend/app/notification/broadcast.py backend/tests/test_broadcasts.py
git commit -m "feat: broadcast audience query with preview and send service"
```

---

### Task 4: Admin endpoints (preview / send / history), router mounting

**Files:**
- Modify: `backend/tests/test_broadcasts.py` (append endpoint tests)
- Modify: `backend/app/notification/broadcast.py` (append `out` + `history`)
- Create: `backend/app/notification/admin_router.py`
- Modify: `backend/app/router.py` (import + include)

- [ ] **Step 1: Write the failing endpoint tests** — append to `backend/tests/test_broadcasts.py` (no new imports needed: `sa`, `ConsolePushProvider`, `admin_headers`, `sign_in` are already imported there):

```python
ADMIN = "/api/v1/admin/broadcasts"


async def test_preview_matches_send_and_records_history(client, engine):
    admin = await admin_headers(client, engine)
    await sign_in(client, "+919845070001")  # artist
    customer = await sign_in(client, "+919845080001", role="customer")
    await client.post(
        "/api/v1/notifications/devices", headers=customer, json={"token": "ExponentPushToken[cust]", "platform": "ios"}
    )

    preview = await client.post(f"{ADMIN}/preview", headers=admin, json={"segment": "all_users", "filters": {}})
    sent = await client.post(
        ADMIN, headers=admin, json={"segment": "all_users", "filters": {}, "title": "Hello", "body": "We are live."}
    )

    assert preview.status_code == 200, preview.text
    assert preview.json() == {"recipients": 2, "with_push": 1}
    assert sent.status_code == 201, sent.text
    assert (sent.json()["recipients"], sent.json()["with_push"]) == (2, 1)

    async with engine.begin() as conn:
        inbox_rows = (await conn.execute(sa.text("SELECT kind, title, link FROM notification"))).all()
        broadcast_row = (
            await conn.execute(sa.text("SELECT segment, recipient_count, push_count FROM notification_broadcast"))
        ).one()
    assert set(inbox_rows) == {("announcement", "Hello", None)}
    assert len(inbox_rows) == 2  # one per recipient, none for the admin
    assert broadcast_row == ("all_users", 2, 1)
    assert [m["to"] for m in ConsolePushProvider.sent] == ["ExponentPushToken[cust]"]
    assert ConsolePushProvider.sent[0]["data"] == {"kind": "announcement", "link": None}


async def test_customers_cannot_touch_broadcasts(client, engine):
    customer = await sign_in(client, "+919845080001", role="customer")

    preview = await client.post(f"{ADMIN}/preview", headers=customer, json={"segment": "all_users"})
    sent = await client.post(ADMIN, headers=customer, json={"segment": "all_users", "title": "Hi", "body": "There"})
    history = await client.get(ADMIN, headers=customer)

    for response in (preview, sent, history):
        assert response.status_code == 403
        assert response.json()["code"] == "forbidden"


async def test_sending_to_an_empty_audience_is_rejected(client, engine):
    admin = await admin_headers(client, engine)

    response = await client.post(
        ADMIN,
        headers=admin,
        json={"segment": "all_customers", "filters": {"city": "Surat"}, "title": "Hello", "body": "Nobody"},
    )

    assert response.status_code == 422
    assert response.json()["code"] == "validation_error"


async def test_history_is_newest_first_with_cursor_pages(client, engine):
    admin = await admin_headers(client, engine)
    await sign_in(client, "+919845070001")
    for i in (1, 2, 3):
        await client.post(
            ADMIN, headers=admin, json={"segment": "all_artists", "filters": {}, "title": f"Note {i}", "body": "Body"}
        )

    first = (await client.get(f"{ADMIN}?limit=2", headers=admin)).json()
    second = (await client.get(f"{ADMIN}?limit=2&cursor={first['next_cursor']}", headers=admin)).json()

    assert [b["title"] for b in first["items"]] == ["Note 3", "Note 2"]
    assert [b["title"] for b in second["items"]] == ["Note 1"]
    assert second["next_cursor"] is None
    assert (first["items"][0]["recipient_count"], first["items"][0]["push_count"]) == (1, 0)
```

- [ ] **Step 2: Run them to see them fail**

Run: `cd backend && .venv/bin/pytest tests/test_broadcasts.py -x -q`
Expected: FAIL — the four new tests get 404s (`/api/v1/admin/broadcasts` doesn't exist yet); the 6 service tests still pass.

- [ ] **Step 3: Append the history service** — add at the end of `backend/app/notification/broadcast.py`:

```python
def out(b: NotificationBroadcast) -> dict[str, Any]:
    return {
        "id": b.id,
        "title": b.title,
        "body": b.body,
        "link": b.link,
        "segment": b.segment,
        "filters": b.filters,
        "recipient_count": b.recipient_count,
        "push_count": b.push_count,
        "created_at": b.created_at,
    }


async def history(session: AsyncSession, limit: int, cursor: str | None) -> tuple[list[dict[str, Any]], str | None]:
    query = keyset(
        select(NotificationBroadcast),
        NotificationBroadcast.created_at,
        NotificationBroadcast.id,
        descending=True,
        cursor=cursor,
    )
    rows = list((await session.scalars(query.limit(limit + 1))).all())
    page, next_cursor = split_page(rows, limit, lambda b: (b.created_at, b.id))
    return [out(b) for b in page], next_cursor
```

- [ ] **Step 4: Create the router** — `backend/app/notification/admin_router.py`:

```python
"""Admin broadcast endpoints: count an exact audience, send to it, and list past sends."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import audited_admin
from app.core.database import get_db
from app.core.exceptions import ValidationError
from app.notification import broadcast
from app.notification.schemas import (
    BroadcastIn,
    BroadcastPage,
    BroadcastPreviewIn,
    BroadcastPreviewOut,
    BroadcastSentOut,
)
from app.shared.responses import errors
from app.user.models import User

router = APIRouter(
    prefix="/admin/broadcasts",
    tags=["admin broadcasts"],
    dependencies=[Depends(audited_admin)],
    responses=errors(401, 403, 422),
)


@router.post("/preview", response_model=BroadcastPreviewOut, status_code=200, summary="Count the exact audience")
async def preview_audience(
    body: BroadcastPreviewIn, session: AsyncSession = Depends(get_db, scope="function")
) -> dict:
    return await broadcast.preview(session, body.segment, body.filters)


@router.post("", response_model=BroadcastSentOut, status_code=201, summary="Send to the audience now")
async def send_broadcast(
    body: BroadcastIn, me: User = Depends(audited_admin), session: AsyncSession = Depends(get_db, scope="function")
) -> dict:
    counts = await broadcast.send(session, me, body)
    if counts is None:
        raise ValidationError("This audience has no recipients")
    return counts


@router.get("", response_model=BroadcastPage, status_code=200, summary="Past sends, newest first")
async def broadcast_history(
    limit: int = Query(30, ge=1, le=100),
    cursor: str | None = None,
    session: AsyncSession = Depends(get_db, scope="function"),
) -> dict:
    items, next_cursor = await broadcast.history(session, limit, cursor)
    return {"items": items, "next_cursor": next_cursor}
```

- [ ] **Step 5: Mount it** — in `backend/app/router.py`, add the import right before the existing notifications import (isort keeps `admin_router` ahead of `router`):

```python
from app.notification import admin_router as notification_admin
from app.notification import router as notifications
```

and add the include after `platform_admin` (it's an admin router; no path collides):

```python
api_router.include_router(platform_admin.router)
api_router.include_router(notification_admin.router)
```

- [ ] **Step 6: Run the whole broadcast suite**

Run: `cd backend && .venv/bin/pytest tests/test_broadcasts.py -x -q`
Expected: all 10 tests pass (6 service + 4 endpoint).

- [ ] **Step 7: Lint, then commit**

Run: `cd backend && .venv/bin/ruff check . && .venv/bin/ruff format --check .`

```bash
git add backend/app/notification/admin_router.py backend/app/notification/broadcast.py backend/app/router.py backend/tests/test_broadcasts.py
git commit -m "feat: admin broadcast endpoints"
```

---

### Task 5: Admin console — broadcasts feature (composer, confirm, history)

**Files:**
- Create: `admin/src/features/broadcasts/types.ts`
- Create: `admin/src/features/broadcasts/queries.ts`
- Create: `admin/src/features/broadcasts/BroadcastsPage.tsx`
- Create: `admin/src/features/broadcasts/broadcasts.test.tsx`
- Modify: `admin/src/test/fake-backend.ts`
- Modify: `admin/src/lib/paths.ts`, `admin/src/app/routes.tsx`, `admin/src/app/page-chunks.ts`, `admin/src/app/layout/nav-items.ts`

- [ ] **Step 1: Create the contracts** — `admin/src/features/broadcasts/types.ts`:

```ts
/** Mirrors backend app/notification/schemas.py (requests) and models.py (history rows). */
export type BroadcastSegment = 'all_users' | 'all_artists' | 'all_customers'

export interface BroadcastFilters {
  city?: string | null
  artist_status?: 'draft' | 'pending' | 'approved' | null
  category_id?: number | null
  joined_from?: string | null
  joined_to?: string | null
}

export interface BroadcastPreviewOut {
  recipients: number
  with_push: number
}

export interface BroadcastSentOut extends BroadcastPreviewOut {
  id: string
}

export interface AdminBroadcast {
  id: string
  title: string
  body: string
  link: string | null
  segment: string
  filters: BroadcastFilters
  recipient_count: number
  push_count: number
  created_at: string
}

export interface BroadcastPage {
  items: AdminBroadcast[]
  next_cursor: string | null
}
```

- [ ] **Step 2: Teach the fake backend the new routes** — three edits in `admin/src/test/fake-backend.ts`:

a) Above the existing `AdminNotification` import (isort: `broadcasts` sorts before `notifications`), add:

```ts
import type { AdminBroadcast, BroadcastFilters, BroadcastPreviewOut, BroadcastSegment } from '@/features/broadcasts/types'
```

b) Right after the `ADMIN` user constant, add the fake audience and the city list:

```ts
const CITIES = ['Bangalore', 'Mumbai', 'Delhi NCR', 'Hyderabad', 'Chennai', 'Pune']

/** Deterministic audience counts so previews and the confirm dialog always read the same. */
function audienceFor(segment: BroadcastSegment, _filters: BroadcastFilters): BroadcastPreviewOut {
  if (segment === 'all_customers') return { recipients: 0, with_push: 0 }
  return segment === 'all_artists' ? { recipients: 1, with_push: 1 } : { recipients: 2, with_push: 1 }
}
```

c) In the `Db` interface, extend the row line to include `broadcasts`:

```ts
  bookings: AdminBooking[]; reviews: AdminReview[]; notifications: AdminNotification[]; broadcasts: AdminBroadcast[]; overview: AdminOverview; me: User
```

In `installFakeBackend()`, extend the `db = { … }` initializer the same way (`notifications: [], broadcasts: [], overview: OVERVIEW,`).

d) In `route(...)`, between the `/notifications/read` block and the 404 fallthrough, add:

```ts
  // Live cities for the broadcast composer's city filter (the public catalog endpoint).
  if (method === 'GET' && path === '/cities') return json(200, CITIES)
  // Admin broadcasts (backend app/notification/admin_router.py).
  if (method === 'POST' && path === '/admin/broadcasts/preview') {
    const { segment, filters } = body as { segment: BroadcastSegment; filters: BroadcastFilters }
    return json(200, audienceFor(segment, filters))
  }
  if (method === 'POST' && path === '/admin/broadcasts') {
    const input = body as { segment: BroadcastSegment; filters: BroadcastFilters; title: string; body: string; link: string | null }
    const counts = audienceFor(input.segment, input.filters)
    if (counts.recipients === 0) return json(422, { code: 'validation_error', message: 'This audience has no recipients' })
    const row: AdminBroadcast = {
      id: `bc-${db.broadcasts.length + 1}`, title: input.title, body: input.body, link: input.link ?? null,
      segment: input.segment, filters: input.filters, recipient_count: counts.recipients, push_count: counts.with_push,
      created_at: '2026-10-31T09:00:00Z',
    }
    db.broadcasts = [row, ...db.broadcasts]
    return json(201, { id: row.id, recipients: counts.recipients, with_push: counts.with_push })
  }
  if (method === 'GET' && path === '/admin/broadcasts') return json(200, { items: db.broadcasts, next_cursor: null })
```

- [ ] **Step 3: Create the data hooks** — `admin/src/features/broadcasts/queries.ts`:

```ts
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { BroadcastFilters, BroadcastPage, BroadcastPreviewOut, BroadcastSegment, BroadcastSentOut } from './types'

export const broadcastKeys = { all: ['admin', 'broadcasts'] as const }

/** Drop empty filter fields so the preview cache key matches what a send will use. */
const clean = (f: BroadcastFilters) =>
  Object.fromEntries(Object.entries(f).filter(([, v]) => v !== null && v !== undefined && v !== '')) as BroadcastFilters

/** The exact audience a send would reach; the composer re-reads it as the admin edits. */
export function useBroadcastPreview(segment: BroadcastSegment, filters: BroadcastFilters) {
  const body = { segment, filters: clean(filters) }
  return useQuery({
    queryKey: [...broadcastKeys.all, 'preview', body],
    queryFn: () => api<BroadcastPreviewOut>('/admin/broadcasts/preview', { method: 'POST', body }),
    placeholderData: (previous) => previous,
  })
}

/** Past sends, newest first. */
export function useBroadcasts() {
  return useInfiniteQuery({
    queryKey: [...broadcastKeys.all, 'list'],
    queryFn: ({ pageParam }) =>
      api<BroadcastPage>(pageParam ? `/admin/broadcasts?cursor=${encodeURIComponent(pageParam)}` : '/admin/broadcasts'),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor,
  })
}

export function useSendBroadcast() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: { segment: BroadcastSegment; filters: BroadcastFilters; title: string; body: string; link: string | null }) =>
      api<BroadcastSentOut>('/admin/broadcasts', { method: 'POST', body: { ...input, filters: clean(input.filters) } }),
    onSuccess: () => client.invalidateQueries({ queryKey: broadcastKeys.all }),
  })
}

/** Live cities for the city filter (the backend's public catalog endpoint). */
export function useCities() {
  return useQuery({ queryKey: ['admin', 'cities'], queryFn: () => api<string[]>('/cities'), staleTime: Infinity })
}
```

- [ ] **Step 4: Write the failing UI tests** — `admin/src/features/broadcasts/broadcasts.test.tsx`:

```tsx
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { calls, db, installFakeBackend } from '@/test/fake-backend'
import { renderSignedIn } from '@/test/render-app'
import type { AdminBroadcast } from './types'

// Mirrors backend BroadcastOut (models.py notification_broadcast).
const sentRow: AdminBroadcast = {
  id: 'bc-1', title: 'Festive slots open', body: 'Book early for November.', link: '/customer/discover',
  segment: 'all_users', filters: { city: 'Bangalore' }, recipient_count: 2, push_count: 1, created_at: '2026-10-31T09:00:00Z',
}

beforeEach(() => installFakeBackend())
afterEach(() => vi.unstubAllGlobals())

it('lists past sends with their audience and reach', async () => {
  db.broadcasts = [sentRow]
  renderSignedIn('/broadcasts')

  const row = (await screen.findByText('Festive slots open', {}, { timeout: 4000 })).closest('tr')
  expect(row).not.toBeNull()
  // "Everyone" also labels the audience picker, so read the table row itself.
  expect(within(row as HTMLElement).getByText('Everyone')).toBeInTheDocument()
  expect(within(row as HTMLElement).getByText('2 people · 1 with push')).toBeInTheDocument()
})

it('previews the audience, confirms, and sends', async () => {
  const user = userEvent.setup()
  renderSignedIn('/broadcasts')

  await user.type(await screen.findByLabelText('Title', {}, { timeout: 4000 }), 'Festive slots open')
  await user.type(screen.getByLabelText('Message'), 'Book early for November.')

  expect(await screen.findByText('This will reach 2 people, 1 with push.', {}, { timeout: 4000 })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Send broadcast' }))
  await user.click(await screen.findByRole('button', { name: 'Send now' }))

  await waitFor(() =>
    expect(calls).toContainEqual({
      method: 'POST',
      path: '/admin/broadcasts',
      body: expect.objectContaining({ segment: 'all_users', title: 'Festive slots open', body: 'Book early for November.' }),
    }),
  )
})

it('refuses to send to an empty audience', async () => {
  const user = userEvent.setup()
  renderSignedIn('/broadcasts')

  await user.click(await screen.findByLabelText('Audience', {}, { timeout: 4000 }))
  await user.click(await screen.findByRole('option', { name: 'All customers' }))
  await user.type(await screen.findByLabelText('Title'), 'Hello')
  await user.type(screen.getByLabelText('Message'), 'Nobody here')

  expect(await screen.findByText('No one matches this audience yet.', {}, { timeout: 4000 })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Send broadcast' })).toBeDisabled()
})

it('blocks an invalid deep link', async () => {
  const user = userEvent.setup()
  renderSignedIn('/broadcasts')

  await user.type(await screen.findByLabelText('Title', {}, { timeout: 4000 }), 'Hi')
  await user.type(screen.getByLabelText('Message'), 'There')
  await user.type(screen.getByLabelText('Link (optional)'), 'https://example.com')

  expect(await screen.findByText('Link must be an in-app path starting with /')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Send broadcast' })).toBeDisabled()
})
```

- [ ] **Step 5: Run them to see them fail**

Run: `cd admin && npm run test -- src/features/broadcasts`
Expected: FAIL — `/broadcasts` has no route yet, so the chunk load fails and every test times out.

- [ ] **Step 6: Wire the route** — four small edits:

In `admin/src/lib/paths.ts`, after the `notifications` entry:

```ts
  notifications: '/notifications',
  broadcasts: '/broadcasts',
```

In `admin/src/app/routes.tsx`, after the notifications route:

```tsx
          <Route path={PATHS.notifications} element={<pages.NotificationsPage />} />
          <Route path={PATHS.broadcasts} element={<pages.BroadcastsPage />} />
```

In `admin/src/app/page-chunks.ts`, after the `NotificationsPage` loader:

```ts
  BroadcastsPage: () => import('@/features/broadcasts/BroadcastsPage').then((m) => ({ default: m.BroadcastsPage })),
```

and after the notifications entry in `loaderByPath`:

```ts
  [PATHS.notifications]: loaders.NotificationsPage,
  [PATHS.broadcasts]: loaders.BroadcastsPage,
```

In `admin/src/app/layout/nav-items.ts`, after the Notifications entry:

```ts
  { to: PATHS.notifications, label: 'Notifications', count: 'unreadNotifications', pill: true },
  { to: PATHS.broadcasts, label: 'Broadcasts' },
```

- [ ] **Step 7: Create the page** — `admin/src/features/broadcasts/BroadcastsPage.tsx`:

```tsx
import { useEffect, useMemo, useState } from 'react'
import { Accent } from '@/components/accent'
import { GridMessage } from '@/components/console/grid-message'
import { Panel } from '@/components/console/panel'
import { PanelFooter } from '@/components/console/panel-footer'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FilterSelect, type FilterOption } from '@/components/ui/filter-select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { useCategories } from '@/features/categories/queries'
import { dateTime } from '@/lib/format'
import { useBroadcastPreview, useBroadcasts, useCities, useSendBroadcast } from './queries'
import type { AdminBroadcast, BroadcastFilters, BroadcastSegment } from './types'

const SEGMENT_OPTIONS: FilterOption<BroadcastSegment>[] = [
  { value: 'all_users', label: 'Everyone' },
  { value: 'all_artists', label: 'All artists' },
  { value: 'all_customers', label: 'All customers' },
]

const STATUS_OPTIONS: FilterOption<'approved' | 'pending' | 'draft'>[] = [
  { value: 'approved', label: 'Approved' },
  { value: 'pending', label: 'Pending' },
  { value: 'draft', label: 'Draft' },
]

const SEGMENT_LABEL: Record<string, string> = {
  all_users: 'Everyone',
  all_artists: 'All artists',
  all_customers: 'All customers',
}

/** A broadcast's link must be an in-app path (`/x`), never an absolute URL. Mirrors the backend rule. */
const LINK_PATTERN = /^\/(?:[^/]|$)/

/** Compose an announcement, see its exact audience, confirm, and send it to in-app inboxes and push. */
export function BroadcastsPage() {
  const [segment, setSegment] = useState<BroadcastSegment>('all_users')
  const [city, setCity] = useState('')
  const [status, setStatus] = useState<'approved' | 'pending' | 'draft'>('approved')
  const [categoryId, setCategoryId] = useState('')
  const [joinedFrom, setJoinedFrom] = useState('')
  const [joinedTo, setJoinedTo] = useState('')
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [link, setLink] = useState('')
  const [confirming, setConfirming] = useState(false)

  const { data: cities = [] } = useCities()
  const { data: categories = [] } = useCategories()
  const history = useBroadcasts()
  const send = useSendBroadcast()
  const rows = history.data?.pages.flatMap((p) => p.items) ?? []

  const artistFiltersVisible = segment !== 'all_customers'
  // Memoised so the debounce below only restarts when a filter actually changes, not on every render.
  const filters = useMemo<BroadcastFilters>(
    () => ({
      city: city || null,
      artist_status: artistFiltersVisible ? status : null,
      category_id: categoryId ? Number(categoryId) : null,
      joined_from: joinedFrom || null,
      joined_to: joinedTo || null,
    }),
    [city, artistFiltersVisible, status, categoryId, joinedFrom, joinedTo],
  )

  // The audience query runs on the settled state, so edits debounce instead of firing per keystroke.
  const [settled, setSettled] = useState({ segment, filters })
  useEffect(() => {
    const timer = setTimeout(() => setSettled({ segment, filters }), 300)
    return () => clearTimeout(timer)
  }, [segment, filters])
  const preview = useBroadcastPreview(settled.segment, settled.filters)
  const counts = preview.data

  const linkValid = link === '' || LINK_PATTERN.test(link)
  const canSend = title.trim() !== '' && message.trim() !== '' && linkValid && (counts?.recipients ?? 0) > 0

  const cityOptions: FilterOption<string>[] = [
    { value: '', label: 'Any city' },
    ...cities.map((c) => ({ value: c, label: c })),
  ]
  const categoryOptions = useMemo<FilterOption<string>[]>(() => {
    const nameOf = new Map(categories.map((c) => [c.id, c.name]))
    return [
      { value: '', label: 'Any category' },
      ...categories.map((c) => ({
        value: String(c.id),
        label: c.parent_id ? `${nameOf.get(c.parent_id)} › ${c.name}` : c.name,
      })),
    ]
  }, [categories])

  const reachLine = preview.isFetching
    ? 'Counting…'
    : counts === undefined
      ? 'Pick an audience to see its size.'
      : counts.recipients === 0
        ? 'No one matches this audience yet.'
        : `This will reach ${counts.recipients} people, ${counts.with_push} with push.`

  return (
    <>
      <PageHeader
        title={<>Broadcasts <Accent>composer</Accent></>}
        subtitle="Compose an announcement, check exactly who it reaches, then send it to in-app inboxes and push."
      />

      <Panel className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <FilterSelect
            label="Audience"
            value={segment}
            options={SEGMENT_OPTIONS}
            onValueChange={(next) => {
              setSegment(next)
              if (next === 'all_customers') {
                setCity('')
                setStatus('approved')
                setCategoryId('')
              }
            }}
          />
          {artistFiltersVisible && <FilterSelect<'approved' | 'pending' | 'draft'> label="Status" value={status} options={STATUS_OPTIONS} onValueChange={setStatus} />}
          {artistFiltersVisible && <FilterSelect label="City" value={city} options={cityOptions} onValueChange={setCity} />}
          {artistFiltersVisible && <FilterSelect label="Category" value={categoryId} options={categoryOptions} onValueChange={setCategoryId} />}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="broadcast-joined-from">Signed up from</Label>
            <Input id="broadcast-joined-from" type="date" className="w-44" value={joinedFrom} onChange={(e) => setJoinedFrom(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="broadcast-joined-to">Signed up until</Label>
            <Input id="broadcast-joined-to" type="date" className="w-44" value={joinedTo} onChange={(e) => setJoinedTo(e.target.value)} />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="broadcast-title">Title</Label>
            <Input id="broadcast-title" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
            <span className="text-[11px] text-muted-foreground">{title.length}/120</span>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="broadcast-link">Link (optional)</Label>
            <Input id="broadcast-link" placeholder="/customer/discover" value={link} maxLength={200} onChange={(e) => setLink(e.target.value)} />
            {!linkValid && <span className="text-[12px] text-destructive">Link must be an in-app path starting with /</span>}
          </div>
          <div className="flex flex-col gap-1 md:col-span-2">
            <Label htmlFor="broadcast-message">Message</Label>
            <Textarea id="broadcast-message" rows={3} value={message} maxLength={300} onChange={(e) => setMessage(e.target.value)} />
            <span className="text-[11px] text-muted-foreground">{message.length}/300</span>
          </div>
        </div>
        <PanelFooter
          end={
            <Button size="sm" onClick={() => setConfirming(true)} disabled={!canSend}>
              Send broadcast
            </Button>
          }
        >
          {reachLine}
        </PanelFooter>
      </Panel>

      <Panel className="flex flex-col">
        {history.isPending && <GridMessage state="loading" />}
        {history.isError && <GridMessage state="error">Couldn’t load past broadcasts. {history.error.message}</GridMessage>}
        {history.isSuccess && rows.length === 0 && <GridMessage state="empty">No broadcasts sent yet.</GridMessage>}
        {rows.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Announcement</TableHead>
                <TableHead>Audience</TableHead>
                <TableHead>Reached</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((b) => <BroadcastRow key={b.id} row={b} />)}
            </TableBody>
          </Table>
        )}
        {history.isSuccess && rows.length > 0 && (
          <PanelFooter
            end={history.hasNextPage && (
              <Button variant="link" size="xs" onClick={() => { void history.fetchNextPage() }} disabled={history.isFetchingNextPage}>
                {history.isFetchingNextPage ? 'Loading…' : 'Load more'}
              </Button>
            )}
          >
            Showing {rows.length}{history.hasNextPage ? '+' : ''}
          </PanelFooter>
        )}
      </Panel>

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send this broadcast?</DialogTitle>
            <DialogDescription>
              {counts ? `This will reach ${counts.recipients} people, ${counts.with_push} with push.` : ''}
            </DialogDescription>
          </DialogHeader>
          <p className="text-label-lg font-semibold">{title.trim()}</p>
          <p className="text-[13px] text-muted-foreground">{message.trim()}</p>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setConfirming(false)}>Cancel</Button>
            <Button
              size="sm"
              disabled={send.isPending}
              onClick={() => {
                send.mutate({ segment, filters, title: title.trim(), body: message.trim(), link: link.trim() || null })
                setConfirming(false)
              }}
            >
              {send.isPending ? 'Sending…' : 'Send now'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function BroadcastRow({ row: b }: { row: AdminBroadcast }) {
  const filterBits = Object.values(b.filters ?? {}).filter((v): v is string => typeof v === 'string' && v !== '')
  return (
    <TableRow>
      <TableCell className="whitespace-nowrap text-muted-foreground">{dateTime(b.created_at)}</TableCell>
      <TableCell>
        <span className="block font-medium">{b.title}</span>
        <span className="block max-w-[360px] truncate text-[12.5px] text-muted-foreground">{b.body}</span>
      </TableCell>
      <TableCell>
        <span className="block">{SEGMENT_LABEL[b.segment] ?? b.segment}</span>
        {filterBits.length > 0 && <span className="block text-[12px] text-muted-foreground">{filterBits.join(' · ')}</span>}
      </TableCell>
      <TableCell>
        {b.recipient_count} people · {b.push_count} with push
      </TableCell>
    </TableRow>
  )
}
```

- [ ] **Step 8: Run the feature tests**

Run: `cd admin && npm run test -- src/features/broadcasts`
Expected: all 4 pass.

- [ ] **Step 9: Gates**

Run: `cd admin && npm run lint && npm run lint:arch && npm run typecheck`
Expected: clean. If `lint:arch` complains about the page importing across features (`@/features/categories/queries`), it already allows that pattern — but if it flags it, move the category options building into `broadcasts/queries.ts` instead.

- [ ] **Step 10: Commit**

```bash
git add admin/src/features/broadcasts admin/src/test/fake-backend.ts admin/src/lib/paths.ts admin/src/app/routes.tsx admin/src/app/page-chunks.ts admin/src/app/layout/nav-items.ts
git commit -m "feat: admin broadcasts page"
```

---

### Task 6: Mobile accepts the `announcement` kind

**Files:**
- Modify: `mobile/src/types/notifications/notifications.ts:2-16` (`NotificationKind` union)

- [ ] **Step 1: Add the kind** — in `mobile/src/types/notifications/notifications.ts`, extend the closed union (the inbox renders kinds it doesn't know as plain rows; this keeps the type honest):

```ts
export type NotificationKind =
  | 'booking_requested'
  | 'booking_accepted'
  | 'booking_declined'
  | 'booking_cancelled'
  | 'order_placed'
  | 'order_confirmed'
  | 'order_shipped'
  | 'order_delivered'
  | 'order_cancelled'
  | 'chat_message'
  | 'support_reply'
  | 'requirement_due'
  | 'requirement_on_hold'
  | 'requirement_reminder'
  // admin broadcasts (push announcements from the console)
  | 'announcement';
```

- [ ] **Step 2: Verify**

Run: `cd mobile && npm run lint && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add mobile/src/types/notifications/notifications.ts
git commit -m "feat: accept announcement kind on mobile inbox"
```

---

### Task 7: Full verification (nothing new — prove the repo is green)

**Files:** none modified. Fix anything that fails, then re-run until clean.

- [ ] **Step 1: Backend**

Run: `cd backend && .venv/bin/pytest -x -q`
Expected: every suite passes (migrations, notifications, broadcasts, and the rest).

Run: `cd backend && .venv/bin/ruff check . && .venv/bin/ruff format --check .`
Expected: clean.

- [ ] **Step 2: Admin**

Run: `cd admin && npm run lint && npm run lint:arch && npm run typecheck && npm run test`
Expected: clean, all suites pass.

- [ ] **Step 3: Mobile**

Run: `cd mobile && npm run lint`
Expected: clean.

- [ ] **Step 4: Manual smoke (optional, needs dev servers)**

Run: `./dev.sh`, sign in as an admin in the console, open **Broadcasts**, send "Hello" to **Everyone**, then check the mobile inbox (or `ConsolePushProvider` logs with `PUSH_PROVIDER=console`) shows the announcement.

**As built:** the full backend suite failed three push assertions because `backend/.env` sets
`PUSH_PROVIDER=expo`, so `get_push_provider()` built `ExpoPushProvider` and never recorded into
`ConsolePushProvider.sent`. The test harness pins every other provider but push; it now also sets
`os.environ["PUSH_PROVIDER"] = "console"` in `backend/tests/conftest.py`. Result: 973 passed,
admin 103 passed, ruff and the frontend gates clean.



