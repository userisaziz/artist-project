# Increment 4 (Part 1): Catalog subcategories — Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admins manage Category → Subcategory → Service templates. Onboarding artists add services only from that list (with their own price, duration and note). Approved artists propose custom services, and admins approve or reject each one.

**Architecture:**
- `categories` gains a self-referencing `parent_id` (two levels only, enforced in `CategoryService`).
- A new `service_templates` table holds the admin's service list.
- `artist_services` gains `template_id`, `status` and `rejection_reason`. A template row takes its name from the template.
- New thin routers: admin templates, admin custom-service queue, and artist custom-service endpoints. Business rules live in services, as today.

**Tech Stack:** FastAPI, SQLAlchemy 2 async, Alembic, Pydantic v2, pytest + pytest-asyncio (real Postgres test DB `art_circle_test`).

**Spec:** `docs/superpowers/specs/2026-10-12-catalog-subcategories-design.md`

**Delivery in parts.** As with Increment 3, the plan comes in three parts:
- **Part 1 (backend)** is written in full below.
- **Admin panel** and **mobile** plans are written after the backend is built and reviewed, so they target the API as it actually ships.

## Global Constraints

- **Levels:** a category with `parent_id = NULL` is top-level. A subcategory's parent must be top-level. No third level.
- **Subcategory slug:** when omitted, `slugify(f"{parent.name} {name}")`, e.g. `makeup-bridal`. Slugs stay globally unique.
- **Names:** category names are unique among siblings (same `parent_id`), case-insensitive. Template names are unique within their subcategory, case-insensitive.
- **In use = hide, don't delete:**
  - A category can't be deleted while it has artists, services, child subcategories or templates (`409 conflict`).
  - A template can't be deleted while any artist offers it (`409 conflict`).
- **Onboarding (`POST /artists/me/services`):**
  - Body is `{template_id, price_paise, duration_minutes, description?}`. Price is `> 0` and `≤ 100_000_000`; duration is `> 0` and `≤ 1440`; description is `≤ 1000` chars.
  - Errors:
    - The template, its subcategory or the parent category is unknown or hidden → `422 "Unknown service"`.
    - The parent isn't one of the artist's categories → `422 "Pick that category on your profile first"`.
    - The artist already has this template → `409 "You've already added this service"`.
- **Template services:** stored with `name = NULL`, `category_id = template.subcategory_id`, `status = approved`. The API `name` is the template's current name.
- **Custom services (`/artists/me/custom-services`):**
  - Only for `approved` profiles, otherwise `409 "Custom services open once your profile is approved"`.
  - New ones and edited ones become `pending`; editing clears `rejection_reason`.
  - Custom rows have `template_id = NULL`.
- **Admin queue (`/admin/custom-services`):**
  - Cursor-paginated `{items, next_cursor}`, oldest `created_at` first.
  - Approve and reject only from `pending`, otherwise `409`.
  - The reject reason follows the `RejectIn` rules (1–500 chars).
- **Profile categories:** `ProfileIn.category_ids` accepts active top-level categories only. Anything else is `422 "Unknown category"`.
- **Errors:** domain errors use `app.core.exceptions` (`ValidationError`, `NotFoundError`, `ConflictError`) so responses keep the `{code, message}` shape.
- **Commits:** every commit message ends with a blank line and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never `git commit --amend`.
- **Commands:** run from `backend/`. Tests: `.venv/bin/python -m pytest -q` (**71 pass before this plan**). Lint: `.venv/bin/ruff check .`.

## Decisions this plan makes

1. **The public tree uses a new schema, `CatalogCategoryOut`.** The spec said `CategoryOut` gains `subcategories`, but `CategoryOut` is also used for an artist's own categories in `ArtistProfileOut`. A separate schema keeps profile responses flat and unchanged. The `GET /categories` JSON is exactly as the spec shows.
2. **No `Category.children` relationship.** The tree and the counts are built from flat queries, so the relationship would be unused.
3. **`sort_order` defaults to last among siblings**, not last overall. For top-level categories this gives the same result as today.
4. **`PATCH /admin/categories/{id}` with `"parent_id": null`** promotes a subcategory to top-level. Any change of parent is a "move", and moves are blocked while the category has artists, services or templates.
5. **The admin queue's `category` is nullable.** Legacy rows point straight at a top-level category, so they have `subcategory` = that category and `category: null`.
6. **Keyset cursor helpers move to `app/utils/cursor.py`**, so the artist queue and the custom-service queue share them. `AdminArtistService` is switched over and its behaviour doesn't change.
7. **The category delete message stays** `"Category is in use; deactivate it instead"`, with no copy change.
8. **The test seed catalog grows.** `seed_categories` adds Mehendi › Bridal (templates "Bridal Classic", "Bridal Full Arms") and Makeup › Party (template "Party Makeup"). `complete_profile` adds "Bridal Classic". Existing test expectations that change because of this are listed in the task that changes them.

## File structure

| File | Change | Responsibility |
|---|---|---|
| `alembic/versions/e5f1b3c7a9d2_catalog_subcategories.py` | create | Migration #6 |
| `app/models/category.py` | modify | `parent_id` |
| `app/models/service_template.py` | create | `ServiceTemplate` model |
| `app/models/artist.py` | modify | `ArtistServiceItem` gains `template_id`, `status`, `rejection_reason`, `template`, `display_name` |
| `app/models/__init__.py` | modify | import `ServiceTemplate` |
| `app/utils/enums.py` | modify | `ArtistServiceStatus` |
| `app/utils/cursor.py` | create | keyset cursor encode/decode |
| `app/schemas/category.py` | modify | `parent_id`, `child_count`, `template_count` |
| `app/schemas/service_template.py` | create | admin template contracts |
| `app/schemas/artist.py` | modify | public tree schemas, new service in/out, custom service schemas, admin queue schemas |
| `app/services/category_service.py` | modify | two-level rules and usage counts |
| `app/services/service_template_service.py` | create | template CRUD |
| `app/services/artist_service.py` | modify | template-based onboarding services, custom services, top-level-only profile categories |
| `app/services/custom_service_review.py` | create | admin queue, approve, reject |
| `app/services/admin_artist_service.py` | modify | use `app/utils/cursor.py` |
| `app/api/v1/catalog.py` | modify | public tree |
| `app/api/v1/admin_service_templates.py` | create | admin template routes |
| `app/api/v1/admin_custom_services.py` | create | admin queue routes |
| `app/api/v1/artists.py` | modify | custom-service routes |
| `app/api/v1/router.py` | modify | include new routers |
| `app/core/dependencies.py` | modify | new service factories |
| `tests/conftest.py` | modify | truncate `service_templates` |
| `tests/test_migrations.py` | modify | new table, legacy-row defaults, round trip |
| `tests/test_admin.py` | modify | subcategory rules, updated expectations |
| `tests/test_catalog.py` | create | templates and public tree |
| `tests/test_artists.py` | modify | seed catalog, template-based services |
| `tests/test_custom_services.py` | create | custom services and admin queue |
| `README.md` | modify | catalog endpoints and the "fill the catalog first" note |

---

### Task 1: Migration #6 and models

**Files:**
- Create: `alembic/versions/e5f1b3c7a9d2_catalog_subcategories.py`
- Create: `app/models/service_template.py`
- Modify: `app/models/category.py`, `app/models/artist.py`, `app/models/__init__.py`, `app/utils/enums.py`
- Test: `tests/test_migrations.py`, `tests/conftest.py`

**Interfaces:**
- Produces:
  - `Category.parent_id: int | None`.
  - `ServiceTemplate(id, subcategory_id, name, description, sort_order, is_active)`.
  - `ArtistServiceStatus` (`approved`, `pending`, `rejected`).
  - `ArtistServiceItem.template_id: int | None`, `.status: ArtistServiceStatus`, `.rejection_reason: str | None`, `.template: ServiceTemplate | None` (selectin), and `.display_name -> str`.

- [ ] **Step 1: Write the failing tests**

In `tests/conftest.py`, add `service_templates` to `TABLES`:

```python
TABLES = "users, user_roles, otp_codes, refresh_tokens, artist_profiles, artist_categories, artist_services, portfolio_photos, categories, artist_kyc, aadhaar_reveals, service_templates"
```

Replace `tests/test_migrations.py` with:

```python
"""Contract test: the test database must carry the full schema.

Migrations are applied session-start in conftest (sync, because alembic's env.py
uses asyncio.run). Here we verify the result, the defaults existing rows get,
and that the newest migration downgrades and upgrades cleanly.
"""

import pytest
import sqlalchemy as sa
from alembic.command import downgrade, upgrade
from alembic.config import Config

from app.core.config import get_settings
from tests.conftest import test_engine
from tests.test_artists import categories, seed_categories, sign_in

EXPECTED_TABLES = {
    "users", "otp_codes", "refresh_tokens", "alembic_version",
    "categories", "artist_profiles", "artist_categories", "artist_services", "portfolio_photos",
    "artist_kyc", "aadhaar_reveals", "service_templates",
}


async def test_migrations_create_all_tables(engine):
    async with engine.connect() as conn:
        rows = (await conn.execute(sa.text(
            "SELECT tablename FROM pg_tables WHERE schemaname='public'"
        ))).scalars().all()
    assert EXPECTED_TABLES <= set(rows)


async def test_existing_services_become_approved_custom_rows(client, engine):
    """Rows written before migration #6 carry no template or status: they read as approved custom services."""
    await seed_categories(engine)
    headers = await sign_in(client, "+919845070001")
    cats = await categories(client)
    profile = (await client.put("/api/v1/artists/me/profile", headers=headers, json={
        "business_name": "A", "city": "Pune", "category_ids": [cats["mehendi"]],
    })).json()
    async with engine.begin() as conn:
        await conn.execute(sa.text(
            "INSERT INTO artist_services (artist_id, category_id, name, price_paise, duration_minutes, sort_order) "
            "VALUES (:a, :c, 'Old service', 100, 30, 0)"
        ), {"a": profile["id"], "c": cats["mehendi"]})
        row = (await conn.execute(sa.text("SELECT status, template_id, name FROM artist_services"))).one()
    assert tuple(row) == ("approved", None, "Old service")

    with pytest.raises(sa.exc.IntegrityError):  # a row needs a template or its own name
        async with engine.begin() as conn:
            await conn.execute(sa.text(
                "INSERT INTO artist_services (artist_id, category_id, price_paise, duration_minutes, sort_order) "
                "VALUES (:a, :c, 100, 30, 1)"
            ), {"a": profile["id"], "c": cats["mehendi"]})


def test_catalog_migration_round_trips():
    """Sync on purpose: alembic's env.py calls asyncio.run."""
    cfg = Config("alembic.ini")
    cfg.set_main_option("sqlalchemy.url", get_settings().test_database_url)
    downgrade(cfg, "d8e2a6b4c1f9")
    upgrade(cfg, "head")
    # The enum type was dropped and recreated with a new OID; pooled asyncpg connections cache the old one.
    # Drop the pool without closing (closing needs the event loop) so later tests get fresh connections.
    test_engine.sync_engine.dispose(close=False)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `.venv/bin/python -m pytest tests/test_migrations.py -q`
Expected: FAIL. `TRUNCATE` errors with `relation "service_templates" does not exist`, and `downgrade(cfg, "d8e2a6b4c1f9")` is a no-op because that is still head.

- [ ] **Step 3: Add the enum**

Append to `app/utils/enums.py`:

```python


class ArtistServiceStatus(str, enum.Enum):
    """Custom services need admin approval; services picked from the admin list are approved on creation."""

    approved = "approved"
    pending = "pending"
    rejected = "rejected"
```

- [ ] **Step 4: Write the migration**

Create `alembic/versions/e5f1b3c7a9d2_catalog_subcategories.py`:

```python
"""subcategories, service_templates, artist_services template/status (migration #6: catalog)

Revision ID: e5f1b3c7a9d2
Revises: d8e2a6b4c1f9
Create Date: 2026-10-12
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = 'e5f1b3c7a9d2'
down_revision: Union[str, Sequence[str], None] = 'd8e2a6b4c1f9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('categories', sa.Column('parent_id', sa.Integer(), sa.ForeignKey('categories.id'), nullable=True))
    op.create_index('ix_categories_parent_id', 'categories', ['parent_id'])

    op.create_table(
        'service_templates',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('subcategory_id', sa.Integer(), sa.ForeignKey('categories.id'), nullable=False),
        sa.Column('name', sa.String(120), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('sort_order', sa.Integer(), server_default=sa.text('0'), nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default=sa.true(), nullable=False),
    )
    op.create_index('ix_service_templates_subcategory_id', 'service_templates', ['subcategory_id'])
    op.create_index('uq_service_templates_subcategory_name', 'service_templates',
                    ['subcategory_id', sa.text('lower(name)')], unique=True)

    op.execute("CREATE TYPE artist_service_status AS ENUM ('approved', 'pending', 'rejected')")
    op.add_column('artist_services', sa.Column(
        'status', postgresql.ENUM(name='artist_service_status', create_type=False),
        server_default=sa.text("'approved'"), nullable=False,
    ))
    op.add_column('artist_services', sa.Column('template_id', sa.Integer(), sa.ForeignKey('service_templates.id'), nullable=True))
    op.create_index('ix_artist_services_template_id', 'artist_services', ['template_id'])
    op.add_column('artist_services', sa.Column('rejection_reason', sa.String(500), nullable=True))
    op.alter_column('artist_services', 'name', existing_type=sa.String(120), nullable=True)
    op.create_check_constraint('ck_artist_services_name_or_template', 'artist_services',
                               'template_id IS NOT NULL OR name IS NOT NULL')


def downgrade() -> None:
    op.drop_constraint('ck_artist_services_name_or_template', 'artist_services', type_='check')
    # Fails (and rolls back) while template rows exist: their names live in service_templates.
    op.alter_column('artist_services', 'name', existing_type=sa.String(120), nullable=False)
    op.drop_column('artist_services', 'rejection_reason')
    op.drop_index('ix_artist_services_template_id', table_name='artist_services')
    op.drop_column('artist_services', 'template_id')
    op.drop_column('artist_services', 'status')
    op.execute("DROP TYPE artist_service_status")
    op.drop_table('service_templates')
    op.drop_index('ix_categories_parent_id', table_name='categories')
    op.drop_column('categories', 'parent_id')
```

- [ ] **Step 5: Update the models**

Replace `app/models/category.py` with:

```python
# app/models/category.py — service categories (Mehendi, Makeup, …) and their subcategories; admins create them in the admin app
from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # NULL = top-level category; set = subcategory. Only two levels (enforced in CategoryService).
    parent_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("categories.id"), index=True)
    slug: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
```

Create `app/models/service_template.py`:

```python
# app/models/service_template.py — the admin's list of services under each subcategory (migration #6)
from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class ServiceTemplate(Base):
    """A service artists can pick during onboarding; each artist sets their own price and duration."""

    __tablename__ = "service_templates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    subcategory_id: Mapped[int] = mapped_column(Integer, ForeignKey("categories.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
```

In `app/models/artist.py`:
- Add `from app.models.service_template import ServiceTemplate` below the `Category` import.
- Change the enums import to `from app.utils.enums import ArtistServiceStatus, ArtistStatus`.
- In `ArtistServiceItem`, replace the `category_id` and `name` lines with:

```python
    # Template rows: the template's subcategory. Custom rows: the chosen subcategory. Pre-#6 rows: a top-level category.
    category_id: Mapped[int] = mapped_column(Integer, ForeignKey("categories.id"), nullable=False)
    template_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("service_templates.id"), index=True)
    name: Mapped[str | None] = mapped_column(String(120))  # NULL for template rows: the template's name is used
```

Then, after the `sort_order` line, add:

```python
    status: Mapped[ArtistServiceStatus] = mapped_column(
        Enum(ArtistServiceStatus, name="artist_service_status", values_callable=lambda e: [m.value for m in e]),
        default=ArtistServiceStatus.approved,
        server_default=sa.text("'approved'"),
        nullable=False,
    )
    rejection_reason: Mapped[str | None] = mapped_column(String(500))
    template: Mapped[ServiceTemplate | None] = relationship(lazy="selectin")
```

In its `__table_args__`, add a third constraint:

```python
        sa.CheckConstraint("template_id IS NOT NULL OR name IS NOT NULL", name="ck_artist_services_name_or_template"),
```

After `__table_args__`, add:

```python
    @property
    def display_name(self) -> str:
        """Template rows follow the admin's current name; custom rows keep their own."""
        return self.template.name if self.template else self.name
```

In `app/models/__init__.py`, add:

```python
from app.models.service_template import ServiceTemplate  # noqa: F401
```

- [ ] **Step 6: Run the tests**

Run: `.venv/bin/python -m pytest -q`
Expected: all pass (71 + 2 new = 73). `ServiceOut` still reads `name` from the row, and existing tests only create named rows.

- [ ] **Step 7: Commit**

```bash
git add alembic/versions/e5f1b3c7a9d2_catalog_subcategories.py app/models app/utils/enums.py tests/conftest.py tests/test_migrations.py
git commit -m "feat(backend): migration #6, subcategories, service templates, service status

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Two-level categories in the admin API, top-level-only profile categories

**Files:**
- Modify: `app/schemas/category.py`, `app/services/category_service.py`, `app/services/artist_service.py` (`_categories` only)
- Test: `tests/test_admin.py`, `tests/test_artists.py`

**Interfaces:**
- Consumes: `Category.parent_id`, `ServiceTemplate` (Task 1).
- Produces:
  - `CategoryIn.parent_id: int | None`, `CategoryPatch.parent_id: int | None`.
  - `AdminCategoryOut` gains `parent_id: int | None`, `child_count: int`, `template_count: int`.
  - `CategoryService` keeps `list`, `create`, `update` and `delete` with the same signatures.
  - Test helper `create_category(client, headers, **body) -> dict` in `tests/test_admin.py`.

- [ ] **Step 1: Write the failing tests**

In `tests/test_admin.py`, update the expected dict in `test_create_category_derives_slug_and_order`:

```python
    assert first.json() | {"id": 0} == {
        "id": 0, "slug": "bridal-makeup", "name": "Bridal Makeup", "sort_order": 0, "is_active": True,
        "parent_id": None, "artist_count": 0, "service_count": 0, "child_count": 0, "template_count": 0,
    }
```

Add these tests after `test_category_in_use_cannot_be_deleted`:

```python
async def create_category(client, headers, **body) -> dict:
    response = await client.post("/api/v1/admin/categories", headers=headers, json=body)
    assert response.status_code == 201, response.json()
    return response.json()


async def test_subcategories_sit_under_a_top_level_category(client, engine):
    headers = await admin(client, engine)
    makeup = await create_category(client, headers, name="Makeup")
    bridal = await create_category(client, headers, name="Bridal", parent_id=makeup["id"])
    assert bridal["slug"] == "makeup-bridal"
    assert bridal["parent_id"] == makeup["id"]
    assert bridal["sort_order"] == 0  # ordered among its siblings

    too_deep = await client.post("/api/v1/admin/categories", headers=headers, json={"name": "HD", "parent_id": bridal["id"]})
    assert too_deep.status_code == 422
    assert too_deep.json()["code"] == "validation_error"
    no_parent = await client.post("/api/v1/admin/categories", headers=headers, json={"name": "HD", "parent_id": 9999})
    assert no_parent.status_code == 422

    listed = (await client.get("/api/v1/admin/categories", headers=headers)).json()
    assert [(c["slug"], c["parent_id"], c["child_count"]) for c in listed] == [
        ("makeup", None, 1), ("makeup-bridal", makeup["id"], 0),
    ]


async def test_subcategory_names_are_unique_per_parent(client, engine):
    headers = await admin(client, engine)
    makeup = await create_category(client, headers, name="Makeup")
    mehendi = await create_category(client, headers, name="Mehendi")
    await create_category(client, headers, name="Bridal", parent_id=makeup["id"])
    other = await create_category(client, headers, name="Bridal", parent_id=mehendi["id"])  # another parent is fine
    assert other["slug"] == "mehendi-bridal"
    dupe = await client.post("/api/v1/admin/categories", headers=headers, json={"name": "bridal", "parent_id": makeup["id"]})
    assert dupe.status_code == 409


async def test_moving_categories_keeps_two_levels(client, engine):
    headers = await admin(client, engine)
    makeup = await create_category(client, headers, name="Makeup")
    hair = await create_category(client, headers, name="Hair")
    bridal = await create_category(client, headers, name="Bridal", parent_id=makeup["id"])
    url = "/api/v1/admin/categories/{}"

    has_children = await client.patch(url.format(makeup["id"]), headers=headers, json={"parent_id": hair["id"]})
    assert has_children.status_code == 422
    own_parent = await client.patch(url.format(hair["id"]), headers=headers, json={"parent_id": hair["id"]})
    assert own_parent.status_code == 422

    moved = await client.patch(url.format(bridal["id"]), headers=headers, json={"parent_id": hair["id"]})
    assert moved.status_code == 200
    assert moved.json()["parent_id"] == hair["id"]
    promoted = await client.patch(url.format(bridal["id"]), headers=headers, json={"parent_id": None})
    assert promoted.json()["parent_id"] is None


async def test_category_with_subcategories_cannot_be_deleted(client, engine):
    headers = await admin(client, engine)
    makeup = await create_category(client, headers, name="Makeup")
    bridal = await create_category(client, headers, name="Bridal", parent_id=makeup["id"])
    assert (await client.delete(f"/api/v1/admin/categories/{makeup['id']}", headers=headers)).status_code == 409
    assert (await client.delete(f"/api/v1/admin/categories/{bridal['id']}", headers=headers)).status_code == 204
    assert (await client.delete(f"/api/v1/admin/categories/{makeup['id']}", headers=headers)).status_code == 204
```

In `tests/test_artists.py`, add after `test_profile_rejects_unknown_city_category_and_foreign_keys`:

```python
async def test_profile_accepts_top_level_categories_only(client, engine):
    headers = await sign_in(client, ARTIST_PHONE)
    cats = await categories(client)
    async with engine.begin() as conn:
        sub_id = (await conn.execute(text(
            "INSERT INTO categories (slug, name, sort_order, parent_id) VALUES ('mehendi-arabic', 'Arabic', 0, :p) RETURNING id"
        ), {"p": cats["mehendi"]})).scalar_one()
    response = await client.put("/api/v1/artists/me/profile", headers=headers, json={
        "business_name": "A", "city": "Bangalore", "category_ids": [sub_id],
    })
    assert response.status_code == 422
    assert response.json()["message"] == "Unknown category"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `.venv/bin/python -m pytest tests/test_admin.py tests/test_artists.py -q`
Expected: FAIL. The new response keys are missing, `parent_id` is ignored (so `too_deep` returns 201), and the subcategory is accepted as a profile category.

- [ ] **Step 3: Update the schemas**

Replace `app/schemas/category.py` with:

```python
"""Admin contracts for managing categories and subcategories (the public tree is `CatalogCategoryOut` in schemas/artist.py)."""

from pydantic import BaseModel, ConfigDict, Field

SLUG = r"^[a-z0-9]+(-[a-z0-9]+)*$"


class CategoryIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    slug: str | None = Field(default=None, max_length=50, pattern=SLUG)  # derived from name (and parent) when omitted
    sort_order: int | None = Field(default=None, ge=0)  # appended last among siblings when omitted
    is_active: bool = True
    parent_id: int | None = None  # set → a subcategory of that top-level category


class CategoryPatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    slug: str | None = Field(default=None, max_length=50, pattern=SLUG)
    sort_order: int | None = Field(default=None, ge=0)
    is_active: bool | None = None
    parent_id: int | None = None  # an explicit null makes a subcategory top-level


class AdminCategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    slug: str
    name: str
    sort_order: int
    is_active: bool
    parent_id: int | None
    artist_count: int
    service_count: int
    child_count: int
    template_count: int
```

- [ ] **Step 4: Rewrite `CategoryService`**

Replace `app/services/category_service.py` with:

```python
"""Admin category management, two levels deep: top-level categories and their subcategories.
Categories in use are deactivated rather than deleted, so existing artists, services and
templates keep a valid reference."""

import re
from typing import NamedTuple

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.models.artist import ArtistServiceItem, artist_categories
from app.models.category import Category
from app.models.service_template import ServiceTemplate
from app.schemas.category import AdminCategoryOut, CategoryIn, CategoryPatch


def slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def siblings(parent_id: int | None):
    return Category.parent_id.is_(None) if parent_id is None else Category.parent_id == parent_id


class Usage(NamedTuple):
    artists: int = 0
    services: int = 0
    children: int = 0
    templates: int = 0


class CategoryService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def _usage(self, category_id: int | None = None) -> dict[int, Usage]:
        queries = (
            select(artist_categories.c.category_id, func.count()).group_by(artist_categories.c.category_id),
            select(ArtistServiceItem.category_id, func.count()).group_by(ArtistServiceItem.category_id),
            select(Category.parent_id, func.count()).where(Category.parent_id.is_not(None)).group_by(Category.parent_id),
            select(ServiceTemplate.subcategory_id, func.count()).group_by(ServiceTemplate.subcategory_id),
        )
        counts = []
        for query in queries:
            if category_id is not None:
                query = query.where(query.selected_columns[0] == category_id)
            counts.append(dict((await self.session.execute(query)).all()))
        return {cid: Usage(*(c.get(cid, 0) for c in counts)) for cid in set().union(*counts)}

    def _out(self, category: Category, usage: dict[int, Usage]) -> AdminCategoryOut:
        u = usage.get(category.id, Usage())
        return AdminCategoryOut(
            id=category.id, slug=category.slug, name=category.name, sort_order=category.sort_order,
            is_active=category.is_active, parent_id=category.parent_id, artist_count=u.artists,
            service_count=u.services, child_count=u.children, template_count=u.templates,
        )

    async def _get(self, category_id: int) -> Category:
        category = await self.session.get(Category, category_id)
        if category is None:
            raise NotFoundError("Category not found")
        return category

    async def _parent(self, parent_id: int) -> Category:
        parent = await self.session.get(Category, parent_id)
        if parent is None or parent.parent_id is not None:
            raise ValidationError("Subcategories can only sit under a top-level category")
        return parent

    async def _ensure_unique(self, slug: str, name: str, parent_id: int | None, exclude_id: int | None = None) -> None:
        """Slugs are unique everywhere; names only among siblings (two parents can each have "Bridal")."""
        query = select(Category.id).where(
            (Category.slug == slug) | ((func.lower(Category.name) == name.lower()) & siblings(parent_id))
        )
        if exclude_id is not None:
            query = query.where(Category.id != exclude_id)
        if await self.session.scalar(query.limit(1)):
            raise ConflictError("A category with that name or slug already exists")

    async def _move(self, category: Category, parent_id: int | None) -> None:
        if parent_id == category.id:
            raise ValidationError("A category can't be its own parent")
        usage = (await self._usage(category.id)).get(category.id, Usage())
        if parent_id is not None:
            await self._parent(parent_id)
            if usage.children:
                raise ValidationError("A category with subcategories can't become a subcategory")
        if usage.artists or usage.services or usage.templates:
            raise ConflictError("Category is in use; it can't be moved")
        category.parent_id = parent_id

    async def list(self) -> list[AdminCategoryOut]:
        rows = (await self.session.scalars(
            select(Category).order_by(Category.parent_id.nulls_first(), Category.sort_order, Category.id)
        )).all()
        usage = await self._usage()
        return [self._out(c, usage) for c in rows]

    async def create(self, body: CategoryIn) -> AdminCategoryOut:
        name = body.name.strip()
        parent = await self._parent(body.parent_id) if body.parent_id is not None else None
        slug = body.slug or slugify(f"{parent.name} {name}" if parent else name)
        if not slug:
            raise ValidationError("Name needs at least one letter or digit")
        await self._ensure_unique(slug, name, body.parent_id)
        sort_order = body.sort_order
        if sort_order is None:
            sort_order = await self.session.scalar(
                select(func.coalesce(func.max(Category.sort_order) + 1, 0)).where(siblings(body.parent_id))
            )
        category = Category(name=name, slug=slug, sort_order=sort_order, is_active=body.is_active, parent_id=body.parent_id)
        self.session.add(category)
        await self.session.flush()
        return self._out(category, {})

    async def update(self, category_id: int, body: CategoryPatch) -> AdminCategoryOut:
        category = await self._get(category_id)
        data = body.model_dump(exclude_unset=True)
        moving = "parent_id" in data and data["parent_id"] != category.parent_id
        if moving:
            await self._move(category, data["parent_id"])
        changes = {k: v for k, v in data.items() if v is not None and k != "parent_id"}
        if "name" in changes:
            changes["name"] = changes["name"].strip()
        if moving or "name" in changes or "slug" in changes:
            await self._ensure_unique(
                changes.get("slug", category.slug), changes.get("name", category.name), category.parent_id, category.id
            )
        for field, value in changes.items():
            setattr(category, field, value)
        await self.session.flush()
        return self._out(category, await self._usage(category.id))

    async def delete(self, category_id: int) -> None:
        category = await self._get(category_id)
        if any((await self._usage(category.id)).get(category.id, Usage())):
            raise ConflictError("Category is in use; deactivate it instead")
        await self.session.delete(category)
        await self.session.flush()
```

- [ ] **Step 5: Make profile categories top-level only**

In `app/services/artist_service.py`, inside `_categories`, change the query's `where` to:

```python
            select(Category).where(Category.id.in_(wanted), Category.is_active.is_(True), Category.parent_id.is_(None))
```

- [ ] **Step 6: Run the tests**

Run: `.venv/bin/python -m pytest -q`
Expected: all pass (73 + 5 = 78).

- [ ] **Step 7: Lint and commit**

```bash
.venv/bin/ruff check .
git add app/schemas/category.py app/services/category_service.py app/services/artist_service.py tests/test_admin.py tests/test_artists.py
git commit -m "feat(backend): subcategories in the admin category API, top-level-only profile categories

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Admin service templates

**Files:**
- Create: `app/schemas/service_template.py`, `app/services/service_template_service.py`, `app/api/v1/admin_service_templates.py`
- Modify: `app/core/dependencies.py`, `app/api/v1/router.py`
- Test: `tests/test_catalog.py` (create), `tests/test_admin.py`

**Interfaces:**
- Consumes: `ServiceTemplate`, `Category.parent_id` (Task 1); `create_category` test helper (Task 2).
- Produces:
  - `GET /api/v1/admin/service-templates?subcategory_id=` → `list[AdminTemplateOut]`.
  - `POST` (201), `PATCH /{id}` and `DELETE /{id}` (204).
  - `AdminTemplateOut = {id, subcategory_id, name, description, sort_order, is_active, artist_count}`.
  - Test helpers in `tests/test_catalog.py`: `create_template(client, headers, **body) -> dict`, `makeup_bridal(client, headers) -> (makeup, bridal)`.

- [ ] **Step 1: Write the failing tests**

In `tests/test_admin.py`, `test_admin_endpoints_refuse_non_admins`, extend the tuple of paths:

```python
    for method, path in (("get", "/api/v1/admin/categories"), ("get", "/api/v1/admin/artists"),
                         ("get", "/api/v1/admin/service-templates?subcategory_id=1")):
```

Create `tests/test_catalog.py`:

```python
"""Catalog contract: the admin's service list under each subcategory, and the public category tree."""

from tests.test_admin import admin, create_category

TEMPLATES = "/api/v1/admin/service-templates"


async def create_template(client, headers, **body) -> dict:
    response = await client.post(TEMPLATES, headers=headers, json=body)
    assert response.status_code == 201, response.json()
    return response.json()


async def makeup_bridal(client, headers) -> tuple[dict, dict]:
    makeup = await create_category(client, headers, name="Makeup")
    return makeup, await create_category(client, headers, name="Bridal", parent_id=makeup["id"])


async def test_template_crud(client, engine):
    headers = await admin(client, engine)
    _, bridal = await makeup_bridal(client, headers)
    hd = await create_template(client, headers, subcategory_id=bridal["id"], name=" HD Bridal Makeup ", description="Long-wear HD base")
    assert hd | {"id": 0} == {
        "id": 0, "subcategory_id": bridal["id"], "name": "HD Bridal Makeup", "description": "Long-wear HD base",
        "sort_order": 0, "is_active": True, "artist_count": 0,
    }
    airbrush = await create_template(client, headers, subcategory_id=bridal["id"], name="Airbrush Bridal")
    assert airbrush["sort_order"] == 1

    patched = await client.patch(f"{TEMPLATES}/{hd['id']}", headers=headers, json={"name": "HD Bridal", "description": None, "is_active": False})
    assert patched.status_code == 200
    assert (patched.json()["name"], patched.json()["description"], patched.json()["is_active"]) == ("HD Bridal", None, False)

    listed = (await client.get(f"{TEMPLATES}?subcategory_id={bridal['id']}", headers=headers)).json()
    assert [t["name"] for t in listed] == ["HD Bridal", "Airbrush Bridal"]
    assert (await client.get("/api/v1/admin/categories", headers=headers)).json()[1]["template_count"] == 2

    assert (await client.delete(f"{TEMPLATES}/{airbrush['id']}", headers=headers)).status_code == 204
    assert (await client.delete(f"{TEMPLATES}/{airbrush['id']}", headers=headers)).status_code == 404
    assert (await client.patch(f"{TEMPLATES}/999999", headers=headers, json={"name": "X"})).status_code == 404


async def test_templates_sit_under_subcategories_with_unique_names(client, engine):
    headers = await admin(client, engine)
    makeup, bridal = await makeup_bridal(client, headers)
    await create_template(client, headers, subcategory_id=bridal["id"], name="HD Bridal Makeup")

    dupe = await client.post(TEMPLATES, headers=headers, json={"subcategory_id": bridal["id"], "name": "hd bridal makeup"})
    assert dupe.status_code == 409
    top_level = await client.post(TEMPLATES, headers=headers, json={"subcategory_id": makeup["id"], "name": "Party"})
    assert top_level.status_code == 422
    assert top_level.json()["code"] == "validation_error"
    unknown = await client.get(f"{TEMPLATES}?subcategory_id=999999", headers=headers)
    assert unknown.status_code == 422
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `.venv/bin/python -m pytest tests/test_catalog.py tests/test_admin.py -q`
Expected: FAIL. Every `/admin/service-templates` call returns 404 because the route doesn't exist.

- [ ] **Step 3: Write the schemas**

Create `app/schemas/service_template.py`:

```python
"""Admin contracts for the service list under each subcategory."""

from pydantic import BaseModel, Field


class TemplateIn(BaseModel):
    subcategory_id: int
    name: str = Field(min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=1000)
    sort_order: int | None = Field(default=None, ge=0)  # appended last when omitted
    is_active: bool = True


class TemplatePatch(BaseModel):
    """No subcategory_id: a template stays where it was created."""

    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=1000)  # an explicit null clears it
    sort_order: int | None = Field(default=None, ge=0)
    is_active: bool | None = None


class AdminTemplateOut(BaseModel):
    id: int
    subcategory_id: int
    name: str
    description: str | None
    sort_order: int
    is_active: bool
    artist_count: int
```

- [ ] **Step 4: Write the service**

Create `app/services/service_template_service.py`:

```python
"""The admin's service list under each subcategory. Templates artists offer are hidden
rather than deleted, so those artists keep a valid reference."""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.models.artist import ArtistServiceItem
from app.models.category import Category
from app.models.service_template import ServiceTemplate
from app.schemas.service_template import AdminTemplateOut, TemplateIn, TemplatePatch


class ServiceTemplateService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def _artist_counts(self, template_id: int | None = None) -> dict[int, int]:
        query = (
            select(ArtistServiceItem.template_id, func.count(func.distinct(ArtistServiceItem.artist_id)))
            .where(ArtistServiceItem.template_id.is_not(None))
            .group_by(ArtistServiceItem.template_id)
        )
        if template_id is not None:
            query = query.where(ArtistServiceItem.template_id == template_id)
        return dict((await self.session.execute(query)).all())

    def _out(self, template: ServiceTemplate, counts: dict[int, int]) -> AdminTemplateOut:
        return AdminTemplateOut(
            id=template.id, subcategory_id=template.subcategory_id, name=template.name,
            description=template.description, sort_order=template.sort_order,
            is_active=template.is_active, artist_count=counts.get(template.id, 0),
        )

    async def _get(self, template_id: int) -> ServiceTemplate:
        template = await self.session.get(ServiceTemplate, template_id)
        if template is None:
            raise NotFoundError("Service not found")
        return template

    async def _subcategory(self, subcategory_id: int) -> Category:
        subcategory = await self.session.get(Category, subcategory_id)
        if subcategory is None or subcategory.parent_id is None:
            raise ValidationError("Services sit under a subcategory")
        return subcategory

    async def _ensure_unique(self, subcategory_id: int, name: str, exclude_id: int | None = None) -> None:
        query = select(ServiceTemplate.id).where(
            ServiceTemplate.subcategory_id == subcategory_id, func.lower(ServiceTemplate.name) == name.lower()
        )
        if exclude_id is not None:
            query = query.where(ServiceTemplate.id != exclude_id)
        if await self.session.scalar(query.limit(1)):
            raise ConflictError("That subcategory already has a service with that name")

    async def list(self, subcategory_id: int) -> list[AdminTemplateOut]:
        await self._subcategory(subcategory_id)
        rows = (await self.session.scalars(
            select(ServiceTemplate).where(ServiceTemplate.subcategory_id == subcategory_id)
            .order_by(ServiceTemplate.sort_order, ServiceTemplate.id)
        )).all()
        counts = await self._artist_counts()
        return [self._out(t, counts) for t in rows]

    async def create(self, body: TemplateIn) -> AdminTemplateOut:
        await self._subcategory(body.subcategory_id)
        name = body.name.strip()
        await self._ensure_unique(body.subcategory_id, name)
        sort_order = body.sort_order
        if sort_order is None:
            sort_order = await self.session.scalar(
                select(func.coalesce(func.max(ServiceTemplate.sort_order) + 1, 0))
                .where(ServiceTemplate.subcategory_id == body.subcategory_id)
            )
        template = ServiceTemplate(
            subcategory_id=body.subcategory_id, name=name, description=body.description,
            sort_order=sort_order, is_active=body.is_active,
        )
        self.session.add(template)
        await self.session.flush()
        return self._out(template, {})

    async def update(self, template_id: int, body: TemplatePatch) -> AdminTemplateOut:
        template = await self._get(template_id)
        changes = body.model_dump(exclude_unset=True)
        if changes.get("name") is not None:
            changes["name"] = changes["name"].strip()
            await self._ensure_unique(template.subcategory_id, changes["name"], template.id)
        for field, value in changes.items():
            if value is not None or field == "description":  # required columns: null means "leave as is"
                setattr(template, field, value)
        await self.session.flush()
        return self._out(template, await self._artist_counts(template.id))

    async def delete(self, template_id: int) -> None:
        template = await self._get(template_id)
        if (await self._artist_counts(template.id)).get(template.id):
            raise ConflictError("Service is in use; hide it instead")
        await self.session.delete(template)
        await self.session.flush()
```

- [ ] **Step 5: Add the router and wiring**

Create `app/api/v1/admin_service_templates.py`:

```python
from fastapi import APIRouter, Depends, Response

from app.core.dependencies import current_admin, get_service_template_service
from app.schemas.service_template import AdminTemplateOut, TemplateIn, TemplatePatch
from app.services.service_template_service import ServiceTemplateService

router = APIRouter(prefix="/admin/service-templates", tags=["admin"], dependencies=[Depends(current_admin)])


@router.get("", response_model=list[AdminTemplateOut])
async def list_templates(
    subcategory_id: int, service: ServiceTemplateService = Depends(get_service_template_service)
) -> list[AdminTemplateOut]:
    return await service.list(subcategory_id)


@router.post("", response_model=AdminTemplateOut, status_code=201)
async def create_template(
    body: TemplateIn, service: ServiceTemplateService = Depends(get_service_template_service)
) -> AdminTemplateOut:
    return await service.create(body)


@router.patch("/{template_id}", response_model=AdminTemplateOut)
async def update_template(
    template_id: int, body: TemplatePatch, service: ServiceTemplateService = Depends(get_service_template_service)
) -> AdminTemplateOut:
    return await service.update(template_id, body)


@router.delete("/{template_id}", status_code=204)
async def delete_template(
    template_id: int, service: ServiceTemplateService = Depends(get_service_template_service)
) -> Response:
    await service.delete(template_id)
    return Response(status_code=204)
```

In `app/core/dependencies.py`, add the import `from app.services.service_template_service import ServiceTemplateService` next to the `CategoryService` import, and this factory after `get_category_service`:

```python
def get_service_template_service(session: AsyncSession = Depends(get_db)) -> ServiceTemplateService:
    return ServiceTemplateService(session)
```

In `app/api/v1/router.py`, import `admin_service_templates` (keep the import list alphabetical) and add:

```python
api_router.include_router(admin_service_templates.router)
```

- [ ] **Step 6: Run the tests**

Run: `.venv/bin/python -m pytest -q`
Expected: all pass (78 + 2 = 80).

- [ ] **Step 7: Lint and commit**

```bash
.venv/bin/ruff check .
git add app/schemas/service_template.py app/services/service_template_service.py app/api/v1/admin_service_templates.py app/core/dependencies.py app/api/v1/router.py tests/test_catalog.py tests/test_admin.py
git commit -m "feat(backend): admin service templates under subcategories

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Public catalog tree (`GET /categories`)

**Files:**
- Modify: `app/schemas/artist.py`, `app/api/v1/catalog.py`
- Test: `tests/test_catalog.py`

**Interfaces:**
- Consumes: `ServiceTemplate` (Task 1); `create_category`, `create_template` and `makeup_bridal` test helpers (Tasks 2–3).
- Produces:
  - `GET /api/v1/categories` → `list[CatalogCategoryOut]`, shaped as `{id, slug, name, subcategories: [{id, slug, name, services: [{id, name, description}]}]}`.
  - Schemas `TemplateOut`, `SubcategoryOut` and `CatalogCategoryOut` in `app/schemas/artist.py`.

- [ ] **Step 1: Write the failing test**

Append to `tests/test_catalog.py`:

```python
async def test_public_catalog_is_a_tree_of_active_items(client, engine):
    headers = await admin(client, engine)
    makeup, bridal = await makeup_bridal(client, headers)
    party = await create_category(client, headers, name="Party", parent_id=makeup["id"], is_active=False)
    hd = await create_template(client, headers, subcategory_id=bridal["id"], name="HD Bridal Makeup", description="Long-wear HD base")
    await create_template(client, headers, subcategory_id=bridal["id"], name="Old look", is_active=False)
    await create_template(client, headers, subcategory_id=party["id"], name="Party glam")
    hair = await create_category(client, headers, name="Hair", is_active=False)
    styling = await create_category(client, headers, name="Styling", parent_id=hair["id"])
    await create_template(client, headers, subcategory_id=styling["id"], name="Blow dry")

    tree = (await client.get("/api/v1/categories")).json()
    assert tree == [{
        "id": makeup["id"], "slug": "makeup", "name": "Makeup",
        "subcategories": [{
            "id": bridal["id"], "slug": "makeup-bridal", "name": "Bridal",
            "services": [{"id": hd["id"], "name": "HD Bridal Makeup", "description": "Long-wear HD base"}],
        }],
    }]
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `.venv/bin/python -m pytest tests/test_catalog.py::test_public_catalog_is_a_tree_of_active_items -q`
Expected: FAIL. The current response is a flat list that includes `makeup-bridal` and has no `subcategories` key.

- [ ] **Step 3: Add the schemas**

In `app/schemas/artist.py`, directly after `class CategoryOut`, add:

```python
class TemplateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None = None


class SubcategoryOut(BaseModel):
    id: int
    slug: str
    name: str
    services: list[TemplateOut]


class CatalogCategoryOut(BaseModel):
    """The public tree. `CategoryOut` stays flat: it is also an artist's own category list."""

    id: int
    slug: str
    name: str
    subcategories: list[SubcategoryOut]
```

- [ ] **Step 4: Build the tree**

Replace the `list_categories` route in `app/api/v1/catalog.py`, and its imports, with:

```python
from collections import defaultdict

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_db
from app.models.category import Category
from app.models.service_template import ServiceTemplate
from app.schemas.artist import CatalogCategoryOut, SubcategoryOut, TemplateOut

router = APIRouter(tags=["catalog"])


@router.get("/categories", response_model=list[CatalogCategoryOut])
async def list_categories(session: AsyncSession = Depends(get_db)) -> list[CatalogCategoryOut]:
    """Active categories → active subcategories → active services. Hiding a level hides everything under it."""
    categories = (await session.scalars(
        select(Category).where(Category.is_active.is_(True)).order_by(Category.sort_order, Category.id)
    )).all()
    templates = (await session.scalars(
        select(ServiceTemplate).where(ServiceTemplate.is_active.is_(True)).order_by(ServiceTemplate.sort_order, ServiceTemplate.id)
    )).all()
    services: dict[int, list[TemplateOut]] = defaultdict(list)
    for template in templates:
        services[template.subcategory_id].append(TemplateOut.model_validate(template))
    subcategories: dict[int, list[SubcategoryOut]] = defaultdict(list)
    for c in categories:
        if c.parent_id is not None:
            subcategories[c.parent_id].append(SubcategoryOut(id=c.id, slug=c.slug, name=c.name, services=services[c.id]))
    return [
        CatalogCategoryOut(id=c.id, slug=c.slug, name=c.name, subcategories=subcategories[c.id])
        for c in categories if c.parent_id is None
    ]
```

Keep the existing `/cities` route unchanged below it.

- [ ] **Step 5: Run the tests**

Run: `.venv/bin/python -m pytest -q`
Expected: all pass (80 + 1 = 81). `test_categories_and_cities_are_public` still passes because it only reads top-level slugs.

- [ ] **Step 6: Lint and commit**

```bash
.venv/bin/ruff check .
git add app/schemas/artist.py app/api/v1/catalog.py tests/test_catalog.py
git commit -m "feat(backend): public catalog tree with subcategories and services

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Onboarding services come from the admin list

**Files:**
- Modify: `app/schemas/artist.py`, `app/services/artist_service.py`
- Test: `tests/test_artists.py`, `tests/test_admin.py`, `tests/test_catalog.py`

**Interfaces:**
- Consumes: `ServiceTemplate`, `ArtistServiceItem.template`/`display_name`/`status`, `ArtistServiceStatus` (Task 1); the public tree (Task 4).
- Produces:
  - `ServiceIn = {template_id, price_paise, duration_minutes, description?}`.
  - `ServicePatch = {price_paise?, duration_minutes?, description?}`.
  - `ServiceOut = {id, category_id, subcategory_id, template_id, name, price_paise, duration_minutes, description, status, rejection_reason}`.
  - `service_out(item) -> ServiceOut` in `app/schemas/artist.py`.
  - `ArtistService._next_service_order(profile) -> int`.
  - Test helpers in `tests/test_artists.py`: the bigger `seed_categories`, and `templates(client) -> dict[str, int]` (service name → template id).

- [ ] **Step 1: Update the test seed and helpers**

In `tests/test_artists.py`, replace `seed_categories` with:

```python
async def seed_categories(engine) -> None:
    """Admins build the catalog in the admin app; tests insert the design's six categories directly,
    plus Mehendi › Bridal and Makeup › Party with a few services so onboarding has something to pick."""
    async with engine.begin() as conn:
        ids = {}
        for i, (slug, name) in enumerate(CATEGORIES):
            ids[slug] = (await conn.execute(
                text("INSERT INTO categories (slug, name, sort_order) VALUES (:s, :n, :i) RETURNING id"),
                {"s": slug, "n": name, "i": i},
            )).scalar_one()
        for parent, slug, name, services in (("mehendi", "mehendi-bridal", "Bridal", ("Bridal Classic", "Bridal Full Arms")),
                                             ("makeup", "makeup-party", "Party", ("Party Makeup",))):
            sub = (await conn.execute(
                text("INSERT INTO categories (slug, name, sort_order, parent_id) VALUES (:s, :n, 0, :p) RETURNING id"),
                {"s": slug, "n": name, "p": ids[parent]},
            )).scalar_one()
            for i, service in enumerate(services):
                await conn.execute(text("INSERT INTO service_templates (subcategory_id, name, sort_order) VALUES (:s, :n, :i)"),
                                   {"s": sub, "n": service, "i": i})
```

After the `categories` helper, add:

```python
async def templates(client) -> dict[str, int]:
    """Service name → template id, from the public catalog tree."""
    tree = (await client.get("/api/v1/categories")).json()
    return {s["name"]: s["id"] for c in tree for sub in c["subcategories"] for s in sub["services"]}
```

In `complete_profile`, replace the `services` POST with:

```python
    await client.post("/api/v1/artists/me/services", headers=headers, json={
        "template_id": (await templates(client))["Bridal Classic"], "price_paise": 550000, "duration_minutes": 180,
    })
```

- [ ] **Step 2: Write the failing tests**

In `tests/test_artists.py`, replace `test_service_crud` and `test_services_need_a_profile_first` with:

```python
async def test_service_crud(client):
    headers = await sign_in(client, ARTIST_PHONE)
    cats, tpl = await categories(client), await templates(client)
    await client.put("/api/v1/artists/me/profile", headers=headers, json={"business_name": "A", "city": "Pune", "category_ids": [cats["makeup"]]})
    added = await client.post("/api/v1/artists/me/services", headers=headers, json={
        "template_id": tpl["Party Makeup"], "price_paise": 300000, "duration_minutes": 90,
    })
    assert added.status_code == 201
    service = added.json()["services"][0]
    assert service | {"id": None, "category_id": None, "subcategory_id": None} == {
        "id": None, "category_id": None, "subcategory_id": None, "template_id": tpl["Party Makeup"],
        "name": "Party Makeup", "price_paise": 300000, "duration_minutes": 90, "description": None,
        "status": "approved", "rejection_reason": None,
    }
    assert service["subcategory_id"] == service["category_id"] != cats["makeup"]  # stored on the subcategory

    patched = await client.patch(f"/api/v1/artists/me/services/{service['id']}", headers=headers,
                                 json={"price_paise": 350000, "name": "Renamed"})  # the name isn't editable
    assert patched.json()["services"][0]["price_paise"] == 350000
    assert patched.json()["services"][0]["name"] == "Party Makeup"

    free = await client.post("/api/v1/artists/me/services", headers=headers, json={
        "template_id": tpl["Party Makeup"], "price_paise": 0, "duration_minutes": 30,
    })
    assert free.status_code == 422

    missing = await client.delete(f"/api/v1/artists/me/services/{uuid.uuid4()}", headers=headers)
    assert missing.status_code == 404
    deleted = await client.delete(f"/api/v1/artists/me/services/{service['id']}", headers=headers)
    assert deleted.json()["services"] == []


async def test_services_need_a_profile_first(client):
    headers = await sign_in(client, ARTIST_PHONE)
    tpl = await templates(client)
    response = await client.post("/api/v1/artists/me/services", headers=headers, json={
        "template_id": tpl["Party Makeup"], "price_paise": 100, "duration_minutes": 30,
    })
    assert response.status_code == 404


async def test_services_come_from_the_admin_list(client, engine):
    headers = await sign_in(client, ARTIST_PHONE)
    cats, tpl = await categories(client), await templates(client)
    await client.put("/api/v1/artists/me/profile", headers=headers, json={"business_name": "A", "city": "Pune", "category_ids": [cats["mehendi"]]})
    url = "/api/v1/artists/me/services"

    def body(template_id: int) -> dict:
        return {"template_id": template_id, "price_paise": 500000, "duration_minutes": 120}

    unknown = await client.post(url, headers=headers, json=body(999999))
    assert (unknown.status_code, unknown.json()["message"]) == (422, "Unknown service")
    other_category = await client.post(url, headers=headers, json=body(tpl["Party Makeup"]))
    assert (other_category.status_code, other_category.json()["message"]) == (422, "Pick that category on your profile first")
    assert (await client.post(url, headers=headers, json=body(tpl["Bridal Classic"]))).status_code == 201
    again = await client.post(url, headers=headers, json=body(tpl["Bridal Classic"]))
    assert (again.status_code, again.json()["code"]) == (409, "conflict")

    async with engine.begin() as conn:  # the admin renames one template and hides another
        await conn.execute(text("UPDATE service_templates SET name = 'Bridal Royal' WHERE id = :i"), {"i": tpl["Bridal Classic"]})
        await conn.execute(text("UPDATE service_templates SET is_active = false WHERE id = :i"), {"i": tpl["Bridal Full Arms"]})
    mine = (await client.get("/api/v1/artists/me", headers=headers)).json()
    assert [s["name"] for s in mine["services"]] == ["Bridal Royal"]
    hidden = await client.post(url, headers=headers, json=body(tpl["Bridal Full Arms"]))
    assert (hidden.status_code, hidden.json()["message"]) == (422, "Unknown service")
```

In `tests/test_admin.py`, `test_category_in_use_cannot_be_deleted`: the service now sits on `mehendi-bridal`, not `mehendi`. Replace the two count asserts with:

```python
    assert (mehendi["artist_count"], mehendi["service_count"], mehendi["child_count"]) == (1, 0, 1)
```

Change the import lines at the top of `tests/test_catalog.py` to:

```python
from tests.test_admin import admin, create_category
from tests.test_artists import complete_profile, seed_categories, sign_in
```

Append to `tests/test_catalog.py`:

```python
async def test_template_in_use_counts_artists_and_cannot_be_deleted(client, engine):
    await seed_categories(engine)
    artist = await sign_in(client, "+919845030001")
    await complete_profile(client, artist, photos=0, kyc=False)
    headers = await admin(client, engine)
    sub_id = next(c["id"] for c in (await client.get("/api/v1/admin/categories", headers=headers)).json() if c["slug"] == "mehendi-bridal")
    listed = (await client.get(f"{TEMPLATES}?subcategory_id={sub_id}", headers=headers)).json()
    classic = next(t for t in listed if t["name"] == "Bridal Classic")
    assert classic["artist_count"] == 1
    response = await client.delete(f"{TEMPLATES}/{classic['id']}", headers=headers)
    assert response.status_code == 409
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `.venv/bin/python -m pytest -q`
Expected: FAIL across `test_artists.py`, `test_admin.py`, `test_kyc.py` and `test_catalog.py`. The service POST returns 422 because `ServiceIn` still requires `category_id` and `name`, so `complete_profile` profiles have no services.

- [ ] **Step 4: Update the service schemas**

In `app/schemas/artist.py`, change the enums import to `from app.utils.enums import ArtistServiceStatus, ArtistStatus`, add `ArtistServiceItem` to the `app.models.artist` import, and replace `ServiceIn`, `ServicePatch` and `ServiceOut` with:

```python
class ServiceIn(BaseModel):
    """Onboarding: a service from the admin's list, with the artist's own price and duration."""

    template_id: int
    price_paise: int = Field(gt=0, le=100_000_000)  # ≤ ₹10 lakh
    duration_minutes: int = Field(gt=0, le=1440)
    description: str | None = Field(default=None, max_length=1000)


class ServicePatch(BaseModel):
    price_paise: int | None = Field(default=None, gt=0, le=100_000_000)
    duration_minutes: int | None = Field(default=None, gt=0, le=1440)
    description: str | None = Field(default=None, max_length=1000)


class ServiceOut(BaseModel):
    id: uuid.UUID
    category_id: int
    subcategory_id: int  # the same column; pre-#6 rows point at a top-level category
    template_id: int | None  # None = custom service
    name: str
    price_paise: int
    duration_minutes: int
    description: str | None = None
    status: ArtistServiceStatus
    rejection_reason: str | None


def service_out(item: ArtistServiceItem) -> ServiceOut:
    return ServiceOut(
        id=item.id, category_id=item.category_id, subcategory_id=item.category_id, template_id=item.template_id,
        name=item.display_name, price_paise=item.price_paise, duration_minutes=item.duration_minutes,
        description=item.description, status=item.status, rejection_reason=item.rejection_reason,
    )
```

In `profile_out`, replace the `services=` line with:

```python
        services=[service_out(s) for s in profile.services],
```

- [ ] **Step 5: Update `ArtistService`**

In `app/services/artist_service.py`:
- Add `from app.models.service_template import ServiceTemplate`.
- Change the enums import to `from app.utils.enums import ArtistServiceStatus, ArtistStatus`.
- Replace `add_service` with:

```python
    def _next_service_order(self, profile: ArtistProfile) -> int:
        return max((s.sort_order for s in profile.services), default=-1) + 1

    async def _template(self, profile: ArtistProfile, template_id: int) -> ServiceTemplate:
        """An active service from the admin's list, under one of the artist's chosen categories."""
        template = await self.session.get(ServiceTemplate, template_id)
        subcategory = await self.session.get(Category, template.subcategory_id) if template else None
        parent = await self.session.get(Category, subcategory.parent_id) if subcategory and subcategory.parent_id else None
        if not (template and template.is_active and subcategory.is_active and parent and parent.is_active):
            raise ValidationError("Unknown service")
        if parent.id not in {c.id for c in profile.categories}:
            raise ValidationError("Pick that category on your profile first")
        return template

    async def add_service(self, user: User, body: ServiceIn) -> ArtistProfile:
        profile = await self._editable(user)
        template = await self._template(profile, body.template_id)
        if any(s.template_id == template.id for s in profile.services):
            raise ConflictError("You've already added this service")
        profile.services.append(ArtistServiceItem(
            template=template,
            category_id=template.subcategory_id,
            price_paise=body.price_paise,
            duration_minutes=body.duration_minutes,
            description=body.description,
            status=ArtistServiceStatus.approved,
            sort_order=self._next_service_order(profile),
        ))
        await self.session.flush()
        return profile
```

- Replace `update_service` with:

```python
    async def update_service(self, user: User, service_id: uuid.UUID, body: ServicePatch) -> ArtistProfile:
        profile = await self._editable(user)
        item = self._service(profile, service_id)
        changes = body.model_dump(exclude_unset=True)
        for field in ("price_paise", "duration_minutes"):
            if changes.get(field) is not None:  # required columns: an explicit null means "leave as is"
                setattr(item, field, changes[field])
        if "description" in changes:
            item.description = changes["description"]
        await self.session.flush()
        return profile
```

Keep `_service` as it is.

- [ ] **Step 6: Run the tests**

Run: `.venv/bin/python -m pytest -q`
Expected: all pass (81 + 2 = 83).

- [ ] **Step 7: Lint and commit**

```bash
.venv/bin/ruff check .
git add app/schemas/artist.py app/services/artist_service.py tests/test_artists.py tests/test_admin.py tests/test_catalog.py
git commit -m "feat(backend): onboarding services are picked from the admin's list

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Custom services for approved artists

**Files:**
- Modify: `app/schemas/artist.py`, `app/services/artist_service.py`, `app/api/v1/artists.py`
- Test: `tests/test_custom_services.py` (create)

**Interfaces:**
- Consumes: `service_out`, `_next_service_order`, `seed_categories` and `templates` (Task 5); `submitted_artist` and `admin` (`tests/test_admin.py`).
- Produces:
  - `POST /api/v1/artists/me/custom-services` (201), `PATCH /api/v1/artists/me/custom-services/{id}` and `DELETE /api/v1/artists/me/custom-services/{id}`. Each returns `ArtistProfileOut`.
  - `CustomServiceIn`, `CustomServicePatch`.
  - `ArtistService.add_custom_service(user, body)`, `.update_custom_service(user, service_id, body)` and `.delete_custom_service(user, service_id)`.
  - Test helpers in `tests/test_custom_services.py`:
    - `approved_artist(client, engine, phone, admin_headers) -> dict` returns the artist's headers. Sign in as admin **once per test** and pass the headers in, because a second OTP request for the same phone inside 60 s gets `429`.
    - `subcategory_id(client, slug) -> int`.
    - `custom(sub_id, name="Glitter mehendi") -> dict` returns a request body.

- [ ] **Step 1: Write the failing tests**

Create `tests/test_custom_services.py`:

```python
"""Custom services: approved artists propose their own services; admins approve or reject each one."""

import uuid

import pytest_asyncio
from sqlalchemy import text

from tests.test_admin import admin, submitted_artist
from tests.test_artists import categories, complete_profile, seed_categories, sign_in

URL = "/api/v1/artists/me/custom-services"


@pytest_asyncio.fixture(autouse=True)
async def catalog_seeded(engine):
    await seed_categories(engine)


async def approved_artist(client, engine, phone: str, admin_headers: dict) -> dict:
    headers = await submitted_artist(client, engine, phone)
    artist_id = (await client.get("/api/v1/artists/me", headers=headers)).json()["id"]
    assert (await client.post(f"/api/v1/admin/artists/{artist_id}/approve", headers=admin_headers)).status_code == 200
    return headers


async def subcategory_id(client, slug: str) -> int:
    tree = (await client.get("/api/v1/categories")).json()
    return next(s["id"] for c in tree for s in c["subcategories"] if s["slug"] == slug)


def custom(sub_id: int, name: str = "Glitter mehendi") -> dict:
    return {"subcategory_id": sub_id, "name": name, "price_paise": 150000, "duration_minutes": 60}


async def test_custom_services_open_after_approval(client, engine):
    headers = await sign_in(client, "+919845040001")
    await complete_profile(client, headers)
    body = custom(await subcategory_id(client, "mehendi-bridal"))
    draft = await client.post(URL, headers=headers, json=body)
    assert (draft.status_code, draft.json()["message"]) == (409, "Custom services open once your profile is approved")
    await client.post("/api/v1/artists/me/submit", headers=headers)
    assert (await client.post(URL, headers=headers, json=body)).status_code == 409


async def test_custom_service_waits_for_review(client, engine):
    admin_headers = await admin(client, engine)
    headers = await approved_artist(client, engine, "+919845040002", admin_headers)
    party = await subcategory_id(client, "makeup-party")  # needn't be under the artist's own categories
    added = await client.post(URL, headers=headers, json=custom(party, " Glitter look "))
    assert added.status_code == 201
    mine = next(s for s in added.json()["services"] if s["template_id"] is None)
    assert (mine["name"], mine["status"], mine["subcategory_id"]) == ("Glitter look", "pending", party)

    top_level = await client.post(URL, headers=headers, json=custom((await categories(client))["mehendi"]))
    assert (top_level.status_code, top_level.json()["message"]) == (422, "Unknown subcategory")
    listed = next(s for s in added.json()["services"] if s["template_id"] is not None)
    assert (await client.patch(f"{URL}/{listed['id']}", headers=headers, json={"price_paise": 1})).status_code == 404


async def test_editing_a_custom_service_resubmits_it(client, engine):
    admin_headers = await admin(client, engine)
    headers = await approved_artist(client, engine, "+919845040003", admin_headers)
    other = await approved_artist(client, engine, "+919845040004", admin_headers)
    added = await client.post(URL, headers=headers, json=custom(await subcategory_id(client, "mehendi-bridal")))
    service_id = next(s["id"] for s in added.json()["services"] if s["template_id"] is None)
    async with engine.begin() as conn:
        await conn.execute(text("UPDATE artist_services SET status = 'rejected', rejection_reason = 'Too vague' WHERE id = :i"), {"i": service_id})

    patched = await client.patch(f"{URL}/{service_id}", headers=headers, json={"price_paise": 160000})
    edited = next(s for s in patched.json()["services"] if s["id"] == service_id)
    assert (edited["status"], edited["rejection_reason"], edited["price_paise"]) == ("pending", None, 160000)

    assert (await client.patch(f"{URL}/{service_id}", headers=other, json={"price_paise": 1})).status_code == 404
    assert (await client.delete(f"{URL}/{uuid.uuid4()}", headers=headers)).status_code == 404
    deleted = await client.delete(f"{URL}/{service_id}", headers=headers)
    assert all(s["id"] != service_id for s in deleted.json()["services"])
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `.venv/bin/python -m pytest tests/test_custom_services.py -q`
Expected: FAIL. The `/custom-services` routes return 404 (or 405).

- [ ] **Step 3: Add the schemas**

In `app/schemas/artist.py`, after `service_out`, add:

```python
class CustomServiceIn(BaseModel):
    """After approval: the artist's own service under any active subcategory; waits for admin review."""

    subcategory_id: int
    name: str = Field(min_length=1, max_length=120)
    price_paise: int = Field(gt=0, le=100_000_000)
    duration_minutes: int = Field(gt=0, le=1440)
    description: str | None = Field(default=None, max_length=1000)


class CustomServicePatch(BaseModel):
    subcategory_id: int | None = None
    name: str | None = Field(default=None, min_length=1, max_length=120)
    price_paise: int | None = Field(default=None, gt=0, le=100_000_000)
    duration_minutes: int | None = Field(default=None, gt=0, le=1440)
    description: str | None = Field(default=None, max_length=1000)
```

- [ ] **Step 4: Add the service methods**

In `app/services/artist_service.py`, add `CustomServiceIn, CustomServicePatch` to the `app.schemas.artist` import. Replace the module docstring with:

```python
"""The signed-in artist's own profile: build it step by step, then submit it for review.

Edits are allowed while the profile is a draft or was rejected; once submitted it is
locked until an admin decides (editing an approved profile is a later feature). Approved
artists can propose custom services, which wait for admin review one by one.
"""
```

Add these methods after `delete_service`:

```python
    async def _approved(self, user: User) -> ArtistProfile:
        profile = await self.get(user)
        if profile.status != ArtistStatus.approved:
            raise ConflictError("Custom services open once your profile is approved")
        return profile

    async def _subcategory(self, subcategory_id: int) -> Category:
        subcategory = await self.session.get(Category, subcategory_id)
        parent = await self.session.get(Category, subcategory.parent_id) if subcategory and subcategory.parent_id else None
        if not (subcategory and subcategory.is_active and parent and parent.is_active):
            raise ValidationError("Unknown subcategory")
        return subcategory

    def _custom(self, profile: ArtistProfile, service_id: uuid.UUID) -> ArtistServiceItem:
        item = self._service(profile, service_id)
        if item.template_id is not None:
            raise NotFoundError("Service not found")
        return item

    async def add_custom_service(self, user: User, body: CustomServiceIn) -> ArtistProfile:
        profile = await self._approved(user)
        await self._subcategory(body.subcategory_id)
        profile.services.append(ArtistServiceItem(
            category_id=body.subcategory_id,
            name=body.name.strip(),
            price_paise=body.price_paise,
            duration_minutes=body.duration_minutes,
            description=body.description,
            status=ArtistServiceStatus.pending,
            sort_order=self._next_service_order(profile),
        ))
        await self.session.flush()
        return profile

    async def update_custom_service(self, user: User, service_id: uuid.UUID, body: CustomServicePatch) -> ArtistProfile:
        """Any edit sends the service back for review."""
        profile = await self._approved(user)
        item = self._custom(profile, service_id)
        changes = body.model_dump(exclude_unset=True)
        if changes.get("subcategory_id") is not None:
            await self._subcategory(changes["subcategory_id"])
            item.category_id = changes["subcategory_id"]
        for field in ("name", "price_paise", "duration_minutes"):
            if changes.get(field) is not None:
                setattr(item, field, changes[field].strip() if field == "name" else changes[field])
        if "description" in changes:
            item.description = changes["description"]
        item.status = ArtistServiceStatus.pending
        item.rejection_reason = None
        await self.session.flush()
        return profile

    async def delete_custom_service(self, user: User, service_id: uuid.UUID) -> ArtistProfile:
        profile = await self._approved(user)
        profile.services.remove(self._custom(profile, service_id))
        await self.session.flush()
        return profile
```

- [ ] **Step 5: Add the routes**

In `app/api/v1/artists.py`, add `CustomServiceIn, CustomServicePatch` to the schema import, and add after `delete_service`:

```python
@router.post("/custom-services", response_model=ArtistProfileOut, status_code=201)
async def add_custom_service(
    body: CustomServiceIn, user: User = Depends(current_artist), service: ArtistService = Depends(get_artist_service)
) -> ArtistProfileOut:
    return profile_out(await service.add_custom_service(user, body), service.storage)


@router.patch("/custom-services/{service_id}", response_model=ArtistProfileOut)
async def update_custom_service(
    service_id: uuid.UUID,
    body: CustomServicePatch,
    user: User = Depends(current_artist),
    service: ArtistService = Depends(get_artist_service),
) -> ArtistProfileOut:
    return profile_out(await service.update_custom_service(user, service_id, body), service.storage)


@router.delete("/custom-services/{service_id}", response_model=ArtistProfileOut)
async def delete_custom_service(
    service_id: uuid.UUID, user: User = Depends(current_artist), service: ArtistService = Depends(get_artist_service)
) -> ArtistProfileOut:
    return profile_out(await service.delete_custom_service(user, service_id), service.storage)
```

- [ ] **Step 6: Run the tests**

Run: `.venv/bin/python -m pytest -q`
Expected: all pass (83 + 3 = 86).

- [ ] **Step 7: Lint and commit**

```bash
.venv/bin/ruff check .
git add app/schemas/artist.py app/services/artist_service.py app/api/v1/artists.py tests/test_custom_services.py
git commit -m "feat(backend): approved artists propose custom services for review

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Admin custom-service queue

**Files:**
- Create: `app/utils/cursor.py`, `app/services/custom_service_review.py`, `app/api/v1/admin_custom_services.py`
- Modify: `app/services/admin_artist_service.py`, `app/schemas/artist.py`, `app/core/dependencies.py`, `app/api/v1/router.py`
- Test: `tests/test_custom_services.py`, `tests/test_admin.py`

**Interfaces:**
- Consumes: the Task 6 endpoints and test helpers; `RejectIn`.
- Produces:
  - `encode_cursor(at: datetime, row_id: uuid.UUID) -> str` and `decode_cursor(cursor: str) -> tuple[datetime, uuid.UUID]` (raises `ValidationError("Invalid cursor")`).
  - `GET /api/v1/admin/custom-services?status=&limit=&cursor=` → `AdminCustomServicePage`.
  - `POST /api/v1/admin/custom-services/{id}/approve` and `/{id}/reject` → `AdminCustomServiceOut`.

- [ ] **Step 1: Write the failing tests**

In `tests/test_admin.py`, `test_admin_endpoints_refuse_non_admins`, add `("get", "/api/v1/admin/custom-services")` to the paths.

Append to `tests/test_custom_services.py`:

```python
QUEUE = "/api/v1/admin/custom-services"


async def test_admin_approves_and_rejects_custom_services(client, engine):
    admin_headers = await admin(client, engine)
    headers = await approved_artist(client, engine, "+919845040010", admin_headers)
    sub = await subcategory_id(client, "mehendi-bridal")
    for name in ("Glitter mehendi", "Neon mehendi"):
        assert (await client.post(URL, headers=headers, json=custom(sub, name))).status_code == 201

    page = (await client.get(f"{QUEUE}?limit=1", headers=admin_headers)).json()
    first = page["items"][0]
    assert first | {"id": None, "artist_id": None, "created_at": None} == {
        "id": None, "artist_id": None, "created_at": None, "business_name": "Ayesha Mehendi Art",
        "category": {"id": (await categories(client))["mehendi"], "name": "Mehendi"},
        "subcategory": {"id": sub, "name": "Bridal"}, "name": "Glitter mehendi", "price_paise": 150000,
        "duration_minutes": 60, "description": None, "status": "pending", "rejection_reason": None,
    }
    second = (await client.get(f"{QUEUE}?limit=1&cursor={page['next_cursor']}", headers=admin_headers)).json()
    assert [i["name"] for i in second["items"]] == ["Neon mehendi"]
    assert second["next_cursor"] is None

    approved = await client.post(f"{QUEUE}/{first['id']}/approve", headers=admin_headers)
    assert approved.json()["status"] == "approved"
    assert (await client.post(f"{QUEUE}/{first['id']}/approve", headers=admin_headers)).status_code == 409
    neon = second["items"][0]["id"]
    assert (await client.post(f"{QUEUE}/{neon}/reject", headers=admin_headers, json={"reason": ""})).status_code == 422
    rejected = await client.post(f"{QUEUE}/{neon}/reject", headers=admin_headers, json={"reason": " Too close to Bridal Classic "})
    assert (rejected.json()["status"], rejected.json()["rejection_reason"]) == ("rejected", "Too close to Bridal Classic")

    mine = (await client.get("/api/v1/artists/me", headers=headers)).json()["services"]
    assert {s["name"]: s["status"] for s in mine} == {"Bridal Classic": "approved", "Glitter mehendi": "approved", "Neon mehendi": "rejected"}
    assert (await client.get(QUEUE, headers=admin_headers)).json()["items"] == []
    assert [i["name"] for i in (await client.get(f"{QUEUE}?status=rejected", headers=admin_headers)).json()["items"]] == ["Neon mehendi"]

    listed = next(s for s in mine if s["template_id"] is not None)  # services from the admin list aren't in the queue
    assert (await client.post(f"{QUEUE}/{listed['id']}/approve", headers=admin_headers)).status_code == 404
    assert (await client.get(f"{QUEUE}?cursor=garbage", headers=admin_headers)).status_code == 422
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `.venv/bin/python -m pytest tests/test_custom_services.py tests/test_admin.py -q`
Expected: FAIL. The `/admin/custom-services` routes return 404.

- [ ] **Step 3: Extract the cursor helpers**

Create `app/utils/cursor.py`:

```python
"""Opaque keyset cursors for admin queues ordered by (timestamp, id): new rows never shift pages."""

import base64
import uuid
from datetime import datetime

from app.core.exceptions import ValidationError


def encode_cursor(at: datetime, row_id: uuid.UUID) -> str:
    return base64.urlsafe_b64encode(f"{at.isoformat()}|{row_id}".encode()).decode()


def decode_cursor(cursor: str) -> tuple[datetime, uuid.UUID]:
    try:
        at, row_id = base64.urlsafe_b64decode(cursor.encode()).decode().split("|")
        return datetime.fromisoformat(at), uuid.UUID(row_id)
    except ValueError as exc:
        raise ValidationError("Invalid cursor") from exc
```

In `app/services/admin_artist_service.py`:
- Delete `_encode_cursor` and `_decode_cursor`, and the now-unused `import base64`.
- Add `from app.utils.cursor import decode_cursor, encode_cursor`.
- In `list`, replace `_decode_cursor(cursor)` with `decode_cursor(cursor)`, and `_encode_cursor(page[-1])` with `encode_cursor(page[-1].submitted_at, page[-1].id)`.
- Remove `ValidationError` from the exceptions import if nothing else in the file uses it. Ruff will flag it otherwise.

- [ ] **Step 4: Add the schemas**

In `app/schemas/artist.py`, after `AdminArtistPage`, add:

```python
class NamedRef(BaseModel):
    id: int
    name: str


class AdminCustomServiceOut(BaseModel):
    id: uuid.UUID
    artist_id: uuid.UUID
    business_name: str
    category: NamedRef | None  # None for pre-#6 rows, which point straight at a top-level category
    subcategory: NamedRef
    name: str
    price_paise: int
    duration_minutes: int
    description: str | None
    status: ArtistServiceStatus
    rejection_reason: str | None
    created_at: datetime


class AdminCustomServicePage(BaseModel):
    items: list[AdminCustomServiceOut]
    next_cursor: str | None
```

- [ ] **Step 5: Write the review service**

Create `app/services/custom_service_review.py`:

```python
"""Admin review of custom services (artist-proposed, outside the admin's list): the queue, approve, reject."""

import uuid

from sqlalchemy import Select, and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.core.exceptions import ConflictError, NotFoundError
from app.models.artist import ArtistProfile, ArtistServiceItem
from app.models.category import Category
from app.schemas.artist import AdminCustomServiceOut, NamedRef
from app.utils.cursor import decode_cursor, encode_cursor
from app.utils.enums import ArtistServiceStatus

Parent = aliased(Category)


def _query() -> Select:
    return (
        select(ArtistServiceItem, ArtistProfile.business_name, Category, Parent)
        .join(ArtistProfile, ArtistProfile.id == ArtistServiceItem.artist_id)
        .join(Category, Category.id == ArtistServiceItem.category_id)
        .outerjoin(Parent, Parent.id == Category.parent_id)
        .where(ArtistServiceItem.template_id.is_(None))
    )


def _out(item: ArtistServiceItem, business_name: str, subcategory: Category, parent: Category | None) -> AdminCustomServiceOut:
    return AdminCustomServiceOut(
        id=item.id, artist_id=item.artist_id, business_name=business_name,
        category=NamedRef(id=parent.id, name=parent.name) if parent else None,
        subcategory=NamedRef(id=subcategory.id, name=subcategory.name),
        name=item.name, price_paise=item.price_paise, duration_minutes=item.duration_minutes,
        description=item.description, status=item.status, rejection_reason=item.rejection_reason,
        created_at=item.created_at,
    )


class CustomServiceReview:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def list(
        self, status: ArtistServiceStatus, limit: int, cursor: str | None
    ) -> tuple[list[AdminCustomServiceOut], str | None]:
        """Oldest first; keyset paging on (created_at, id)."""
        query = _query().where(ArtistServiceItem.status == status)
        if cursor:
            at, sid = decode_cursor(cursor)
            query = query.where(or_(
                ArtistServiceItem.created_at > at,
                and_(ArtistServiceItem.created_at == at, ArtistServiceItem.id > sid),
            ))
        rows = (await self.session.execute(
            query.order_by(ArtistServiceItem.created_at, ArtistServiceItem.id).limit(limit + 1)
        )).all()
        page = rows[:limit]
        last = page[-1][0] if page else None
        return [_out(*row) for row in page], encode_cursor(last.created_at, last.id) if len(rows) > limit else None

    async def _decide(self, service_id: uuid.UUID, status: ArtistServiceStatus, reason: str | None) -> AdminCustomServiceOut:
        row = (await self.session.execute(_query().where(ArtistServiceItem.id == service_id))).one_or_none()
        if row is None:
            raise NotFoundError("Custom service not found")
        item = row[0]
        if item.status != ArtistServiceStatus.pending:
            raise ConflictError(f"Service is {item.status.value}, not pending")
        item.status = status
        item.rejection_reason = reason
        await self.session.flush()
        return _out(*row)

    async def approve(self, service_id: uuid.UUID) -> AdminCustomServiceOut:
        return await self._decide(service_id, ArtistServiceStatus.approved, None)

    async def reject(self, service_id: uuid.UUID, reason: str) -> AdminCustomServiceOut:
        return await self._decide(service_id, ArtistServiceStatus.rejected, reason.strip())
```

- [ ] **Step 6: Add the router and wiring**

Create `app/api/v1/admin_custom_services.py`:

```python
import uuid
from typing import Literal

from fastapi import APIRouter, Depends, Query

from app.core.dependencies import current_admin, get_custom_service_review
from app.schemas.artist import AdminCustomServiceOut, AdminCustomServicePage, RejectIn
from app.services.custom_service_review import CustomServiceReview
from app.utils.enums import ArtistServiceStatus

router = APIRouter(prefix="/admin/custom-services", tags=["admin"], dependencies=[Depends(current_admin)])


@router.get("", response_model=AdminCustomServicePage)
async def list_custom_services(
    status: Literal["pending", "approved", "rejected"] = "pending",
    limit: int = Query(20, ge=1, le=100),
    cursor: str | None = None,
    review: CustomServiceReview = Depends(get_custom_service_review),
) -> AdminCustomServicePage:
    items, next_cursor = await review.list(ArtistServiceStatus(status), limit, cursor)
    return AdminCustomServicePage(items=items, next_cursor=next_cursor)


@router.post("/{service_id}/approve", response_model=AdminCustomServiceOut)
async def approve_custom_service(
    service_id: uuid.UUID, review: CustomServiceReview = Depends(get_custom_service_review)
) -> AdminCustomServiceOut:
    return await review.approve(service_id)


@router.post("/{service_id}/reject", response_model=AdminCustomServiceOut)
async def reject_custom_service(
    service_id: uuid.UUID, body: RejectIn, review: CustomServiceReview = Depends(get_custom_service_review)
) -> AdminCustomServiceOut:
    return await review.reject(service_id, body.reason)
```

In `app/core/dependencies.py`, import `CustomServiceReview` from `app.services.custom_service_review` and add:

```python
def get_custom_service_review(session: AsyncSession = Depends(get_db)) -> CustomServiceReview:
    return CustomServiceReview(session)
```

In `app/api/v1/router.py`, import `admin_custom_services` and add:

```python
api_router.include_router(admin_custom_services.router)
```

- [ ] **Step 7: Run the tests**

Run: `.venv/bin/python -m pytest -q`
Expected: all pass (86 + 1 = 87). The existing artist-queue paging tests confirm the cursor refactor didn't change behaviour.

- [ ] **Step 8: Lint and commit**

```bash
.venv/bin/ruff check .
git add app/utils/cursor.py app/services/custom_service_review.py app/services/admin_artist_service.py app/api/v1/admin_custom_services.py app/schemas/artist.py app/core/dependencies.py app/api/v1/router.py tests/test_custom_services.py tests/test_admin.py
git commit -m "feat(backend): admin queue to approve or reject custom services

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: README and final verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Document the catalog**

In `README.md`, insert this subsection directly before `### Error contract`:

````markdown
### Catalog and services

The catalog has three levels: **category → subcategory → service**. Admins build it in the admin panel, and the apps read it from one public endpoint.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/categories` | none | Active tree: `[{id, slug, name, subcategories: [{id, slug, name, services: [{id, name, description}]}]}]` |
| GET/POST/PATCH/DELETE | `/admin/categories` | admin | Categories and subcategories (`parent_id` set = subcategory; two levels only) |
| GET/POST/PATCH/DELETE | `/admin/service-templates` | admin | The service list under a subcategory (`GET` needs `?subcategory_id=`) |
| POST/PATCH/DELETE | `/artists/me/services` | artist | Onboarding: `{template_id, price_paise, duration_minutes, description?}` from the admin list |
| POST/PATCH/DELETE | `/artists/me/custom-services` | approved artist | `{subcategory_id, name, price_paise, duration_minutes, description?}`; each one waits for review |
| GET | `/admin/custom-services` | admin | Review queue, `?status=pending\|approved\|rejected&limit=&cursor=` |
| POST | `/admin/custom-services/{id}/approve` · `/reject` | admin | Reject takes `{reason}` |

Anything in use (a category with artists, services, subcategories or templates; a template an artist offers) can only be hidden, not deleted.

> **Fill in the catalog before artists onboard.** During onboarding, artists can only add services from the admin's list. If a category has no subcategories and services, artists in it can't add a service and can't submit their profile.
````

- [ ] **Step 2: Run the full suite and lint**

Run: `.venv/bin/python -m pytest -q && .venv/bin/ruff check .`
Expected: 87 passed, and ruff reports no issues.

- [ ] **Step 3: Check the dev database migrates**

Run: `.venv/bin/alembic upgrade head && .venv/bin/alembic current`
Expected: `e5f1b3c7a9d2 (head)`.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs(backend): catalog, service templates and custom services

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
