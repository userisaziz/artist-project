# FastAPI Best-Practices Rules + Backend Module-First Restructure — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adopt zhanymkanov/fastapi-best-practices as standing Qoder + Claude rules, and migrate `backend/app/` from layer-first to module-first layout with zero API contract changes.

**Architecture:** One package per domain (`auth`, `user`, `catalog`, `artist`, `booking`, `review`, `directory`, `upload`), each owning router/service/repository/models/schemas/dependencies. Global code stays in `app/core/` and `app/shared/`. Migration is `git mv` + scripted import rewrite + controller-inlining; verified by the existing pytest suite, ruff, and a before/after `/openapi.json` diff.

**Tech Stack:** FastAPI, SQLAlchemy 2 async, Alembic, Pydantic v2, pytest (real Postgres), ruff, uv.

**Spec:** `docs/superpowers/specs/2026-10-17-fastapi-best-practices-restructure-design.md`

**Commit discipline:** Stage ONLY backend/ + rules docs + this plan's own files. The working tree has unrelated uncommitted `admin/` and `mobile/` changes — never `git add -A` at repo root; add explicit paths only.

---

### Task 1: Branch, baseline green, OpenAPI snapshot

**Files:**
- Create: `/tmp/openapi_before.json` (baseline artifact, not committed)

- [ ] **Step 1: Create the work branch**

```bash
cd /Users/almabetter/artist-project && git checkout -b backend-module-first-restructure
```

- [ ] **Step 2: Verify the suite is green BEFORE touching anything**

Run: `cd backend && uv run pytest -q`
Expected: all tests PASS (harness uses local Postgres `art_circle_test`; if the DB is down, start it and re-run — do not proceed on a red baseline).

- [ ] **Step 3: Snapshot OpenAPI baseline**

Run:

```bash
cd backend && uv run python -c "import json; from app.main import create_app; print(json.dumps(create_app().openapi(), indent=2, sort_keys=True))" > /tmp/openapi_before.json && wc -l /tmp/openapi_before.json
```

Expected: file exists with paths (`/api/v1/auth/otp/request` etc. visible via `grep -c '"/api/v1' /tmp/openapi_before.json`, count > 0).

---

### Task 2: Rules documents (Qoder + project Claude + global Claude)

**Files:**
- Create: `.qoder/rules/fastapi-best-practices.md`
- Create: `CLAUDE.md` (repo root)
- Create: `~/.claude/CLAUDE.md` (does not exist today)

- [ ] **Step 1: Write `.qoder/rules/fastapi-best-practices.md` with exactly this content**

```markdown
---
trigger: glob
globs: backend/**/*.py
---

# FastAPI Best Practices (zhanymkanov/fastapi-best-practices)

Opinionated rules for all backend/ code. Source: https://github.com/zhanymkanov/fastapi-best-practices

## Project structure — module-first
- One package per domain under `app/`: each has `router.py` (all endpoints),
  `schemas.py` (Pydantic), `models.py` (SQLAlchemy), `service.py` (business logic),
  `repository.py` (data access), `dependencies.py`, `utils.py`, `constants.py`,
  `exceptions.py` — create only what the domain needs.
- Global code lives at `app/core/` (config, database, security, exceptions) and
  `app/shared/` (Base model, pagination, enums, common schemas). Never duplicate
  these into domains.
- Cross-domain imports use explicit module names:
  `from app.review import service as review_service` — never import whole packages or use wildcards.
- Routes stay thin: endpoint functions validate via dependencies and delegate to `service.py`.

## Async routes — decision table
| Work | Form |
|---|---|
| Awaitable non-blocking I/O | `async def` |
| Blocking I/O, no async client | sync `def` (FastAPI threadpools it) |
| Mixed | `async def` + `await run_in_threadpool(sync_fn, ...)` |
| CPU-bound (>50 ms compute) | never in-process — worker/task queue (phase 2) |
- NEVER call `time.sleep()`, requests, or other blocking I/O inside `async def`.

## Pydantic
- Validate excessively in schemas (`Field(min_length/pattern/ge)`, `EmailStr`, enums) — not in services.
- Use `StrEnum` for enumerations; union syntax `X | None`.
- All API models extend one custom base (`app/shared/schemas.py`) controlling datetime serialization.
- Settings: global `app/core/config.py`; domain-specific env vars go in a per-module `config.py`, not crammed into global.
- A `ValueError` raised in a request-body schema validator becomes a user-visible 422 ValidationError — raise domain exceptions in services instead.

## Dependencies
- Use dependencies for request validation against DB (`valid_booking_id` etc.), not just DI.
- Chain dependencies (`valid_owned_booking` depends on `valid_booking_id` + `current_user`); results are cached per-request — split small reusable dependencies freely.
- Prefer `async def` dependencies (sync ones pay threadpool overhead).

## REST
- Same resource = same path variable name across endpoints (`booking_id` everywhere) so dependencies chain.
- Always set `response_model`, `status_code`, `tags`, `summary`/`description` on routes.
- Do not pre-instantiate the `response_model` object just to return it — FastAPI rebuilds and revalidates it (double cost). Return dicts/ORM rows and let FastAPI serialize.

## Background work
- `BackgroundTasks`: only short (<1 s), droppable, in-process tasks. If losing the task would page someone → real queue (not built yet; do not add silently).

## Docs/security
- OpenAPI docs only on local/staging: `openapi_url=None` in production.

## Database
- Naming: lower snake_case, singular, module prefix (`artist_service_item`), `_at` suffix for datetime, `_date` for date.
- Explicit Postgres naming convention in `MetaData` (see `app/shared/models.py`); never rely on SQLAlchemy defaults.
- SQL-first, Pydantic-second: complex joins/aggregations belong in SQL (`json_build_object`), not Python post-processing.

## Migrations (Alembic)
- Migrations must be static and reversible; edit generated files to add `downgrade()`.
- Generate with descriptive slug: `uv run alembic revision --autogenerate -m "<what changes>"` → filename `YYYY-MM-DD_<slug>.py` (set via `file_template` in alembic.ini).

## Tests
- Async client only: `httpx.AsyncClient` + `ASGITransport` (already the harness in `tests/conftest.py`) — never sync TestClient.
- Swap auth/external deps via `app.dependency_overrides`, never monkeypatch internals.
- Every behavior change ships with a test in `tests/` (flat layout, file per domain).

## Lint
- `ruff check` + `ruff format` gate every commit; ruff replaces black/isort/autoflake.
```

- [ ] **Step 2: Write root `CLAUDE.md` with exactly this content** (single source, DRY via `@`-import)

```markdown
# CLAUDE.md

## Backend (FastAPI) — always-on rules

@.qoder/rules/fastapi-best-practices.md

Backend layout: module-first, one package per domain under `backend/app/`
(auth, user, catalog, artist, booking, review, directory, upload) plus global
`core/` and `shared/`. Run tests from `backend/` with `uv run pytest -q`.
```

- [ ] **Step 3: Create `~/.claude/CLAUDE.md` (global, terse) — file does not exist; create with exactly this content**

```markdown
# Global rules

## When working on FastAPI projects
- Structure module-first: `src/<domain>/` with router.py, schemas.py, models.py,
  service.py, dependencies.py, constants.py, exceptions.py, utils.py. Global
  config/db/exceptions/pagination at `src/` root. Cross-domain imports use
  explicit module names.
- Routes thin, logic in service.py. Sync blocking I/O in `def` routes or
  `run_in_threadpool`; never block the event loop in `async def`. CPU-bound → worker process.
- Validate in Pydantic schemas and async, chainable, cached dependencies
  (e.g. `valid_<resource>_id`); same path variable names across endpoints.
- One custom Pydantic base model; per-module BaseSettings, not one global blob.
- Always set response_model/status_code/tags; don't pre-build response objects
  (FastAPI revalidates — double serialization cost).
- BackgroundTasks only for short, droppable, in-process work; otherwise task queue.
- SQL-first: heavy joins/aggregation in SQL (json_build_object), not Python.
- DB naming: snake_case, singular, module prefix, `_at`/`_date` suffixes; explicit
  MetaData naming convention; migrations static + reversible with slug filenames.
- Hide OpenAPI docs outside local/staging.
- Tests: async httpx ASGITransport client, dependency_overrides (no monkeypatching).
- Lint/format with ruff only.
```

- [ ] **Step 4: Verify files exist and frontmatter parses**

Run: `head -5 /Users/almabetter/artist-project/.qoder/rules/fastapi-best-practices.md && ls -la ~/.claude/CLAUDE.md`
Expected: frontmatter block printed; both files listed.

- [ ] **Step 5: Commit**

```bash
cd /Users/almabetter/artist-project
git add .qoder/rules/fastapi-best-practices.md CLAUDE.md
git commit -m "docs: add fastapi best-practices rules for qoder and claude"
```

( `~/.claude/CLAUDE.md` is outside the repo — not committed.)

---

### Task 3: Import-rewrite script + auth domain (worked example)

**Files:**
- Create: `backend/scripts/migrate_imports.py` (temporary tool, deleted in Task 10)
- Move: `app/routes/auth/auth.py`→`app/auth/router.py`, `app/controllers/auth/dependencies.py`→`app/auth/dependencies.py`, `app/services/auth/auth.py`→`app/auth/service.py`, `app/services/auth/sms.py`→`app/auth/sms.py`, `app/repositories/auth/auth.py`→`app/auth/repository.py`, `app/models/auth/auth.py`→`app/auth/models.py`, `app/schemas/auth/auth.py`→`app/auth/schemas.py`
- Delete: `app/controllers/auth/auth.py` (inlined into router)

- [ ] **Step 1: Write `backend/scripts/migrate_imports.py`**

```python
"""One-shot import rewriter for the module-first migration.

Usage: uv run python scripts/migrate_imports.py <domain>
Rewrites old layer-first module paths to new module-first paths across app/
and tests/. Line-listed rewrites run before prefix rewrites (longest first).
Delete this script in the final assembly task.
"""

import re
import sys
from pathlib import Path

# domain -> list of (old_import_string, new_import_string)
DOMAINS: dict[str, list[tuple[str, str]]] = {
    "auth": [
        ("app.routes.auth.auth", "app.auth.router"),
        ("app.controllers.auth.auth", "app.auth.router"),
        ("app.controllers.auth.dependencies", "app.auth.dependencies"),
        ("app.services.auth.auth", "app.auth.service"),
        ("app.services.auth.sms", "app.auth.sms"),
        ("app.repositories.auth.auth", "app.auth.repository"),
        ("app.models.auth.auth", "app.auth.models"),
        ("app.schemas.auth.auth", "app.auth.schemas"),
    ],
    "user": [
        ("app.routes.user.user", "app.user.router"),
        ("app.controllers.user.user", "app.user.router"),
        ("app.controllers.user.dependencies", "app.user.dependencies"),
        ("app.services.user.user", "app.user.service"),
        ("app.repositories.user.user", "app.user.repository"),
        ("app.models.user.user", "app.user.models"),
        ("app.schemas.user.user", "app.user.schemas"),
    ],
    "catalog": [
        ("app.routes.catalog.catalog", "app.catalog.router"),
        ("app.routes.catalog.admin", "app.catalog.admin_router"),
        ("app.controllers.catalog.catalog", "app.catalog.router"),
        ("app.controllers.catalog.admin", "app.catalog.admin_router"),
        ("app.controllers.catalog.dependencies", "app.catalog.dependencies"),
        ("app.controllers.catalog.presenters", "app.catalog.utils"),
        ("app.services.catalog.catalog", "app.catalog.service"),
        ("app.services.catalog.template", "app.catalog.template"),
        ("app.repositories.catalog.catalog", "app.catalog.repository"),
        ("app.models.catalog.catalog", "app.catalog.models"),
        ("app.schemas.catalog.catalog", "app.catalog.schemas"),
    ],
    "artist": [
        ("app.routes.artist.artist", "app.artist.router"),
        ("app.routes.artist.admin", "app.artist.admin_router"),
        ("app.controllers.artist.artist", "app.artist.router"),
        ("app.controllers.artist.admin", "app.artist.admin_router"),
        ("app.controllers.artist.dependencies", "app.artist.dependencies"),
        ("app.controllers.artist.presenters", "app.artist.utils"),
        ("app.services.artist.artist", "app.artist.service"),
        ("app.services.artist.admin", "app.artist.admin_service"),
        ("app.services.artist.aadhaar", "app.artist.aadhaar"),
        ("app.services.artist.custom_service_review", "app.artist.custom_service_review"),
        ("app.repositories.artist.artist", "app.artist.repository"),
        ("app.models.artist.artist", "app.artist.models"),
        ("app.schemas.artist.artist", "app.artist.schemas"),
    ],
    "upload": [
        ("app.routes.upload.upload", "app.upload.router"),
        ("app.controllers.upload.upload", "app.upload.router"),
        ("app.services.upload.storage", "app.upload.service"),
        ("app.schemas.upload.upload", "app.upload.schemas"),
    ],
    "booking": [
        ("from app.services import booking_service", "from app.booking import service as booking_service"),
        ("from app.models import booking", "from app.booking import models as booking"),
        ("from app.utils import booking_rules", "from app.booking import rules as booking_rules"),
        ("app.api.v1.bookings", "app.booking.router"),
        ("app.api.v1.artist_bookings", "app.booking.artist_router"),
        ("app.api.v1.admin_bookings", "app.booking.admin_router"),
        ("app.services.booking_service", "app.booking.service"),
        ("app.services.admin_booking_service", "app.booking.admin_service"),
        ("app.models.booking", "app.booking.models"),
        ("app.schemas.booking", "app.booking.schemas"),
        ("app.utils.booking_rules", "app.booking.rules"),
    ],
    "review": [
        ("from app.services import review_service", "from app.review import service as review_service"),
        ("from app.models import review", "from app.review import models as review"),
        ("from app.utils import review_filter", "from app.review import filters as review_filter"),
        ("app.api.v1.artist_reviews", "app.review.artist_router"),
        ("app.api.v1.admin_reviews", "app.review.admin_router"),
        ("app.services.review_service", "app.review.service"),
        ("app.models.review", "app.review.models"),
        ("app.schemas.review", "app.review.schemas"),
        ("app.utils.review_filter", "app.review.filters"),
    ],
    "directory": [
        ("from app.services import directory_service", "from app.directory import service as directory_service"),
        ("app.api.v1.directory", "app.directory.router"),
        ("app.services.directory_service", "app.directory.service"),
        ("app.schemas.directory", "app.directory.schemas"),
    ],
    "shared": [
        ("app.schemas.common", "app.shared.schemas"),
    ],
}

TARGETS = ["app", "tests"]


def rewrite_file(path: Path, pairs: list[tuple[str, str]]) -> None:
    text = path.read_text()
    original = text
    for old, new in sorted(pairs, key=lambda p: -len(p[0])):
        if old.startswith("from "):  # full-line style rewrite
            text = text.replace(old, new)
        else:
            text = re.sub(rf"\b{re.escape(old)}\b", new, text)
    if text != original:
        path.write_text(text)


def main(domain: str) -> None:
    pairs = DOMAINS[domain]
    root = Path.cwd()
    for target in TARGETS:
        for py in (root / target).rglob("*.py"):
            if "__pycache__" not in str(py):
                rewrite_file(py, pairs)
    print(f"rewrote imports for domain: {domain}")


if __name__ == "__main__":
    main(sys.argv[1])
```

- [ ] **Step 2: Create the auth package and move files (git mv preserves history)**

```bash
cd backend
mkdir -p app/auth && touch app/auth/__init__.py
git mv app/routes/auth/auth.py app/auth/router.py
git mv app/controllers/auth/dependencies.py app/auth/dependencies.py
git mv app/services/auth/auth.py app/auth/service.py
git mv app/services/auth/sms.py app/auth/sms.py
git mv app/repositories/auth/auth.py app/auth/repository.py
git mv app/models/auth/auth.py app/auth/models.py
git mv app/schemas/auth/auth.py app/auth/schemas.py
git rm app/controllers/auth/auth.py app/controllers/auth/__init__.py app/routes/auth/auth.py app/routes/auth/__init__.py app/services/auth/__init__.py app/repositories/auth/__init__.py app/models/auth/__init__.py app/schemas/auth/__init__.py 2>/dev/null || true
```

(If `git rm` complains about paths already moved, that's fine — the `__init__.py` files of the emptied layer sub-packages are removed; `app/routes/auth/` etc. should be gone.)

- [ ] **Step 3: Rewrite every auth import across app/ and tests/**

Run: `cd backend && uv run python scripts/migrate_imports.py auth`
Expected: `rewrote imports for domain: auth`

- [ ] **Step 4: Inline the controller into `app/auth/router.py`**

`app/auth/router.py` must end up exactly as below (controller bodies moved into route functions; no logic changes; note `app.auth.schemas` import form — the script produced `from app.auth.schemas import ...` lines, keep them):

```python
from fastapi import APIRouter, Depends, Response

from app.auth.dependencies import get_auth_service
from app.auth.schemas import OTPRequest, OTPVerify, RefreshRequest, TokenPair
from app.auth.service import AuthService
from app.schemas.user.user import UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/otp/request", status_code=204)
async def request_otp(body: OTPRequest, service: AuthService = Depends(get_auth_service)) -> Response:
    # 204 regardless of whether the phone exists: no user-enumeration signal.
    await service.request_otp(body.phone)
    return Response(status_code=204)


@router.post("/otp/verify", response_model=TokenPair)
async def verify_otp(body: OTPVerify, service: AuthService = Depends(get_auth_service)) -> TokenPair:
    user, access, refresh = await service.verify_otp(body.phone, body.code)
    return TokenPair(access_token=access, refresh_token=refresh, user=UserOut.model_validate(user))


@router.post("/refresh", response_model=TokenPair)
async def refresh(body: RefreshRequest, service: AuthService = Depends(get_auth_service)) -> TokenPair:
    user, access, refresh_token = await service.refresh(body.refresh_token)
    return TokenPair(access_token=access, refresh_token=refresh_token, user=UserOut.model_validate(user))
```

Note: `from app.schemas.user.user import UserOut` intentionally keeps the OLD path — the user domain is not moved until Task 4, and Task 4 Step 2's `migrate_imports.py user` run rewrites this line to `from app.user.schemas import UserOut` automatically. Do not hand-write future paths.

- [ ] **Step 5: Update the still-existing old-style router import in `app/routes/__init__.py`**

The script rewrote `from app.routes.auth import auth` → nothing there (that file is `app.routes.auth.auth` module reference inside `app/routes/__init__.py` written as `from app.routes.auth import auth`). Add to this check: open `app/routes/__init__.py`, the auth line must read `from app.auth import router as auth` and usage `auth.router` stays valid. (Task 10 replaces this whole file.)

- [ ] **Step 6: Run tests**

Run: `cd backend && uv run pytest -q`
Expected: full suite PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/app/auth backend/scripts/migrate_imports.py backend/app/routes/__init__.py
git add -u backend/app backend/tests
git commit -m "refactor(backend): move auth domain to module-first package"
```

(`git add -u` stages the deletions/renames of tracked files only — never adds untracked admin/mobile work.)

---

### Task 4: user domain

**Files:**
- Move: `app/routes/user/user.py`→`app/user/router.py`, `app/controllers/user/dependencies.py`→`app/user/dependencies.py`, `app/services/user/user.py`→`app/user/service.py`, `app/repositories/user/user.py`→`app/user/repository.py`, `app/models/user/user.py`→`app/user/models.py`, `app/schemas/user/user.py`→`app/user/schemas.py`
- Delete: `app/controllers/user/user.py` (inline), `app/schemas/common.py`→`app/shared/schemas.py` (also here, via `shared` domain rewrite)

- [ ] **Step 1: Move files**

```bash
cd backend
mkdir -p app/user && touch app/user/__init__.py
git mv app/routes/user/user.py app/user/router.py
git mv app/controllers/user/dependencies.py app/user/dependencies.py
git mv app/services/user/user.py app/user/service.py
git mv app/repositories/user/user.py app/user/repository.py
git mv app/models/user/user.py app/user/models.py
git mv app/schemas/user/user.py app/user/schemas.py
git mv app/schemas/common.py app/shared/schemas.py
git rm app/controllers/user/user.py
git rm app/controllers/user/__init__.py app/routes/user/__init__.py app/services/user/__init__.py app/repositories/user/__init__.py app/models/user/__init__.py app/schemas/user/__init__.py 2>/dev/null || true
```

(Before the `git rm` of `app/controllers/user/user.py`, read its function bodies — Step 3 inlines them. For every domain task, copy controller bodies while the file is on disk.)

- [ ] **Step 2: Rewrite imports**

Run: `cd backend && uv run python scripts/migrate_imports.py user && uv run python scripts/migrate_imports.py shared`
Expected: two `rewrote imports...` lines. This also fixes Task 3's deferred `UserOut` import in `app/auth/router.py` → `from app.user.schemas import UserOut` — apply that now and confirm it.

- [ ] **Step 3: Inline the controller into `app/user/router.py`**

The script does NOT rewrite package-style controller imports (`from app.controllers.user import user as controller`). Handle them in the inline step: (a) delete every line matching `grep -n "controllers" app/user/router.py`; (b) replace each route body `return await controller.<fn>(...)` with the exact body of `<fn>` from the deleted `app/controllers/user/user.py`; (c) keep every comment, status code, `response_model`, and signature unchanged. Finish check: `grep -rn "app\.controllers" app/user` → no matches.

- [ ] **Step 4: Fix `app/routes/__init__.py` user line as in Task 3 Step 5** (`from app.user import router as user`)

- [ ] **Step 5: Run tests** — `uv run pytest -q` → all PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/user backend/app/shared/schemas.py
git add -u backend/app backend/tests
git commit -m "refactor(backend): move user domain to module-first package; common schemas to shared"
```

---

### Task 5: catalog domain

**Files:**
- Move: `routes/catalog/catalog.py`→`catalog/router.py`, `routes/catalog/admin.py`→`catalog/admin_router.py`, `controllers/catalog/dependencies.py`→`catalog/dependencies.py`, `controllers/catalog/presenters.py`→`catalog/utils.py`, `services/catalog/catalog.py`→`catalog/service.py`, `services/catalog/template.py`→`catalog/template.py`, `repositories/catalog/catalog.py`→`catalog/repository.py`, `models/catalog/catalog.py`→`catalog/models.py`, `schemas/catalog/catalog.py`→`catalog/schemas.py`
- Delete: `controllers/catalog/catalog.py`, `controllers/catalog/admin.py` (inline into the two routers)

- [ ] **Step 1: Move files**

```bash
cd backend
mkdir -p app/catalog && touch app/catalog/__init__.py
git mv app/routes/catalog/catalog.py app/catalog/router.py
git mv app/routes/catalog/admin.py app/catalog/admin_router.py
git mv app/controllers/catalog/dependencies.py app/catalog/dependencies.py
git mv app/controllers/catalog/presenters.py app/catalog/utils.py
git mv app/services/catalog/catalog.py app/catalog/service.py
git mv app/services/catalog/template.py app/catalog/template.py
git mv app/repositories/catalog/catalog.py app/catalog/repository.py
git mv app/models/catalog/catalog.py app/catalog/models.py
git mv app/schemas/catalog/catalog.py app/catalog/schemas.py
git rm app/controllers/catalog/catalog.py app/controllers/catalog/admin.py
git rm app/controllers/catalog/__init__.py app/routes/catalog/__init__.py app/services/catalog/__init__.py app/repositories/catalog/__init__.py app/models/catalog/__init__.py app/schemas/catalog/__init__.py 2>/dev/null || true
```

- [ ] **Step 2: Rewrite imports** — `uv run python scripts/migrate_imports.py catalog`

- [ ] **Step 3: Inline controllers** — same procedure as Task 4 Step 3 (delete `controllers` import lines, paste `<fn>` bodies over `return await controller.<fn>(...)`, verify `grep -rn "app\.controllers" app/catalog` is empty), applied to `app/catalog/router.py` (from deleted `controllers/catalog/catalog.py`) and `app/catalog/admin_router.py` (from deleted `controllers/catalog/admin.py`). Bodies only; preserve everything else.

- [ ] **Step 4: Fix `app/routes/__init__.py`** — lines become `from app.catalog import router as catalog`, `from app.catalog import admin_router as catalog_admin` (usage `catalog.router`, `catalog_admin.router` unchanged).

- [ ] **Step 5: `uv run pytest -q`** → all PASS

- [ ] **Step 6: Commit** — `git add backend/app/catalog && git add -u backend/app backend/tests && git commit -m "refactor(backend): move catalog domain to module-first package"`

---

### Task 6: artist domain

**Files:**
- Move: `routes/artist/artist.py`→`artist/router.py`, `routes/artist/admin.py`→`artist/admin_router.py`, `controllers/artist/dependencies.py`→`artist/dependencies.py`, `controllers/artist/presenters.py`→`artist/utils.py`, `services/artist/artist.py`→`artist/service.py`, `services/artist/admin.py`→`artist/admin_service.py`, `services/artist/aadhaar.py`→`artist/aadhaar.py`, `services/artist/custom_service_review.py`→`artist/custom_service_review.py`, `repositories/artist/artist.py`→`artist/repository.py`, `models/artist/artist.py`→`artist/models.py`, `schemas/artist/artist.py`→`artist/schemas.py`
- Delete: `controllers/artist/artist.py`, `controllers/artist/admin.py` (inline)

- [ ] **Step 1: Move files**

```bash
cd backend
mkdir -p app/artist && touch app/artist/__init__.py
git mv app/routes/artist/artist.py app/artist/router.py
git mv app/routes/artist/admin.py app/artist/admin_router.py
git mv app/controllers/artist/dependencies.py app/artist/dependencies.py
git mv app/controllers/artist/presenters.py app/artist/utils.py
git mv app/services/artist/artist.py app/artist/service.py
git mv app/services/artist/admin.py app/artist/admin_service.py
git mv app/services/artist/aadhaar.py app/artist/aadhaar.py
git mv app/services/artist/custom_service_review.py app/artist/custom_service_review.py
git mv app/repositories/artist/artist.py app/artist/repository.py
git mv app/models/artist/artist.py app/artist/models.py
git mv app/schemas/artist/artist.py app/artist/schemas.py
git rm app/controllers/artist/artist.py app/controllers/artist/admin.py
git rm app/controllers/artist/__init__.py app/routes/artist/__init__.py app/services/artist/__init__.py app/repositories/artist/__init__.py app/models/artist/__init__.py app/schemas/artist/__init__.py 2>/dev/null || true
```

- [ ] **Step 2: Rewrite imports** — `uv run python scripts/migrate_imports.py artist`
- [ ] **Step 3: Inline controllers** — Task 4 Step 3 procedure (delete `controllers` import lines, paste `<fn>` bodies over `return await controller.<fn>(...)`), for `app/artist/router.py` and `app/artist/admin_router.py`. Finish check: `grep -rn "app\.controllers" app/artist` → no matches.
- [ ] **Step 4: Fix `app/routes/__init__.py`** — `from app.artist import router as artist`, `from app.artist import admin_router as artist_admin`.
- [ ] **Step 5: `uv run pytest -q`** → all PASS (this is the biggest domain — check `tests/test_artist*.py` and `tests/test_aadhaar.py` names explicitly with `-k artist or aadhaar` first if suite time matters)
- [ ] **Step 6: Commit** — `git add backend/app/artist && git add -u backend/app backend/tests && git commit -m "refactor(backend): move artist domain to module-first package"`

---

### Task 7: upload domain

**Files:**
- Move: `routes/upload/upload.py`→`upload/router.py`, `services/upload/storage.py`→`upload/service.py`, `schemas/upload/upload.py`→`upload/schemas.py`
- Delete: `controllers/upload/upload.py` (inline)

- [ ] **Step 1: Move files**

```bash
cd backend
mkdir -p app/upload && touch app/upload/__init__.py
git mv app/routes/upload/upload.py app/upload/router.py
git mv app/services/upload/storage.py app/upload/service.py
git mv app/schemas/upload/upload.py app/upload/schemas.py
git rm app/controllers/upload/upload.py
git rm app/controllers/upload/__init__.py app/routes/upload/__init__.py app/services/upload/__init__.py app/schemas/upload/__init__.py 2>/dev/null || true
```

- [ ] **Step 2: Rewrite imports** — `uv run python scripts/migrate_imports.py upload`
- [ ] **Step 3: Inline controller** — Task 4 Step 3 procedure, for `app/upload/router.py` (bodies from `app/controllers/upload/upload.py`, read before Step 1's `git rm` deleted it). Finish check: `grep -rn "app\.controllers" app/upload` → no matches.

- [ ] **Step 4: Fix `app/routes/__init__.py`** — `from app.upload import router as upload`
- [ ] **Step 5: `uv run pytest -q`** → all PASS
- [ ] **Step 6: Commit** — `git add backend/app/upload && git add -u backend/app backend/tests && git commit -m "refactor(backend): move upload domain to module-first package"`

---

### Task 8: booking + review domains (coupled — single task)

`api/v1/bookings.py` mounts review-creation under `/bookings` and calls the review service; `directory` and `admin` routers cross-import too. Migrate both packages in one task so cross-imports resolve within the task.

**Files:**
- Move: `api/v1/bookings.py`→`booking/router.py`, `api/v1/artist_bookings.py`→`booking/artist_router.py`, `api/v1/admin_bookings.py`→`booking/admin_router.py`, `services/booking_service.py`→`booking/service.py`, `services/admin_booking_service.py`→`booking/admin_service.py`, `models/booking.py`→`booking/models.py`, `schemas/booking.py`→`booking/schemas.py`, `utils/booking_rules.py`→`booking/rules.py`, `api/v1/artist_reviews.py`→`review/artist_router.py`, `api/v1/admin_reviews.py`→`review/admin_router.py`, `services/review_service.py`→`review/service.py`, `models/review.py`→`review/models.py`, `schemas/review.py`→`review/schemas.py`, `utils/review_filter.py`→`review/filters.py`
- Note: there is NO standalone user-facing `review/router.py` — review creation lives in `booking/router.py` (spec note confirmed by file inspection).

- [ ] **Step 1: Move files**

```bash
cd backend
mkdir -p app/booking app/review && touch app/booking/__init__.py app/review/__init__.py
git mv app/api/v1/bookings.py app/booking/router.py
git mv app/api/v1/artist_bookings.py app/booking/artist_router.py
git mv app/api/v1/admin_bookings.py app/booking/admin_router.py
git mv app/services/booking_service.py app/booking/service.py
git mv app/services/admin_booking_service.py app/booking/admin_service.py
git mv app/models/booking.py app/booking/models.py
git mv app/schemas/booking.py app/booking/schemas.py
git mv app/utils/booking_rules.py app/booking/rules.py
git mv app/api/v1/artist_reviews.py app/review/artist_router.py
git mv app/api/v1/admin_reviews.py app/review/admin_router.py
git mv app/services/review_service.py app/review/service.py
git mv app/models/review.py app/review/models.py
git mv app/schemas/review.py app/review/schemas.py
git mv app/utils/review_filter.py app/review/filters.py
```

- [ ] **Step 2: Rewrite imports** — `uv run python scripts/migrate_imports.py review && uv run python scripts/migrate_imports.py booking` (review first so booking routers' rewritten imports hit existing paths)

- [ ] **Step 3: No controller inlining here** — these api/v1 files already contain route bodies directly. Verify: `grep -rn "controller" app/booking app/review` → no matches.

- [ ] **Step 4: Cross-domain import style check** — in `app/booking/router.py` etc., cross-domain imports must use explicit module form. Acceptable as rewritten by the script (`from app.review.service import ReviewService, get_review_service`); do NOT further rewrite to package-level forms — content-preserving move is the contract.

- [ ] **Step 5: Fix `app/routes/__init__.py`** — the six `from app.api.v1 import (...)` entries become individual lines: `from app.booking import admin_router as admin_bookings`, `from app.booking import artist_router as artist_bookings`, `from app.booking import router as bookings`, `from app.review import admin_router as admin_reviews`, `from app.review import artist_router as artist_reviews` (directory handled in Task 9). Usage lines (`bookings.router` etc.) unchanged.

- [ ] **Step 6: `uv run pytest -q`** → all PASS (`-k "booking or review"` first for a fast signal)

- [ ] **Step 7: Commit**

```bash
git add backend/app/booking backend/app/review
git add -u backend/app backend/tests
git commit -m "refactor(backend): move booking and review domains to module-first packages"
```

---

### Task 9: directory domain

**Files:**
- Move: `api/v1/directory.py`→`directory/router.py`, `services/directory_service.py`→`directory/service.py`, `schemas/directory.py`→`directory/schemas.py`

- [ ] **Step 1: Move files**

```bash
cd backend
mkdir -p app/directory && touch app/directory/__init__.py
git mv app/api/v1/directory.py app/directory/router.py
git mv app/services/directory_service.py app/directory/service.py
git mv app/schemas/directory.py app/directory/schemas.py
git rm app/api/v1/__init__.py
```

- [ ] **Step 2: Rewrite imports** — `uv run python scripts/migrate_imports.py directory`
- [ ] **Step 3: Fix `app/routes/__init__.py`** — `from app.directory import router as directory`; verify the include ORDER is untouched (directory must stay after all `/artists/me` routers — its comment says why).
- [ ] **Step 4: `uv run pytest -q`** → all PASS
- [ ] **Step 5: Commit** — `git add backend/app/directory && git add -u backend/app backend/tests && git commit -m "refactor(backend): move directory domain to module-first package"`

---

### Task 10: Final assembly — app/router.py, registry, main, cleanup, full gates

**Files:**
- Create: `app/router.py`
- Modify: `app/main.py` (one import), `app/registry.py` (full rewrite), `alembic.ini`
- Delete: `app/routes/` (whole package incl. `__init__.py`), `app/api/`, `app/controllers/`, `app/services/`, `app/repositories/`, `app/schemas/`, `app/models/`, `app/utils/`, `scripts/migrate_imports.py`

- [ ] **Step 1: Create `backend/app/router.py`** — exact content (same assembly and ORDER as the old `routes/__init__.py`; only import paths changed):

```python
"""`api_router` (/api/v1): every domain's routers. Each /artists/me… router comes before the directory,
otherwise "me" would be read as an artist id."""

from fastapi import APIRouter

from app.artist import admin_router as artist_admin
from app.artist import router as artist
from app.auth import router as auth
from app.booking import admin_router as admin_bookings
from app.booking import artist_router as artist_bookings
from app.booking import router as bookings
from app.catalog import admin_router as catalog_admin
from app.catalog import router as catalog
from app.directory import router as directory
from app.review import admin_router as admin_reviews
from app.review import artist_router as artist_reviews
from app.upload import router as upload
from app.user import router as user

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router)
api_router.include_router(user.router)
api_router.include_router(catalog.router)
api_router.include_router(upload.router)
api_router.include_router(artist.router)
api_router.include_router(artist_bookings.router)
api_router.include_router(artist_reviews.router)
api_router.include_router(directory.router)  # after every /artists/me router: "me" isn't an artist id
api_router.include_router(bookings.router)
api_router.include_router(artist_admin.router)
api_router.include_router(admin_bookings.router)
api_router.include_router(admin_reviews.router)
api_router.include_router(catalog_admin.router)
```

- [ ] **Step 2: Rewrite `app/registry.py`** — exact content:

```python
"""Imports every domain's models so `Base.metadata` is complete (Alembic env and tests use it)."""

from app.artist import models as artist_models  # noqa: F401
from app.auth import models as auth_models  # noqa: F401
from app.booking import models as booking_models  # noqa: F401
from app.catalog import models as catalog_models  # noqa: F401
from app.review import models as review_models  # noqa: F401
from app.shared.models import Base
from app.user import models as user_models  # noqa: F401

__all__ = ["Base"]
```

- [ ] **Step 3: Point `app/main.py` at the new assembly** — replace `from app.routes import api_router` with `from app.router import api_router`. Nothing else in `main.py` changes.

- [ ] **Step 4: Delete the emptied layer packages and the migration script**

```bash
cd backend
git rm -r app/routes app/api app/controllers app/services app/repositories app/schemas app/models app/utils
rm scripts/migrate_imports.py
```

- [ ] **Step 5: Add alembic file_template rule** — in `backend/alembic.ini`, under `[alembic]`, add:

```ini
file_template = %%(year)d-%%(month).2d-%%(day).2d_%%(slug)s
```

- [ ] **Step 6: Sweep for dead references**

Run: `cd backend && grep -rn "app\.routes\|app\.controllers\|app\.services\|app\.repositories\|app\.schemas\|app\.models\b\|app\.utils\|app\.api" app tests alembic --include="*.py"`
Expected: ZERO matches. Any hit = missed rewrite; fix it to the module-first path from Task 3's DOMAINS table.

- [ ] **Step 7: Full verification gates**

```bash
cd backend
rm -rf app/**/__pycache__ tests/__pycache__ 2>/dev/null; find . -name __pycache__ -not -path "./.venv/*" -exec rm -rf {} + 2>/dev/null
uv run pytest -q                     # gate 1: all green
uv run ruff check app tests          # gate 2: no errors (fix any unused-import fallout from inlining)
uv run ruff format --check app tests || uv run ruff format app tests && uv run pytest -q
uv run python -c "import json; from app.main import create_app; print(json.dumps(create_app().openapi(), indent=2, sort_keys=True))" > /tmp/openapi_after.json
diff /tmp/openapi_before.json /tmp/openapi_after.json && echo "OPENAPI IDENTICAL"   # gate 3
```

Expected: `OPENAPI IDENTICAL`. If the diff shows only reordering of `tags`/`servers`, investigate and fix ordering (route include order must match baseline); response schemas and paths must be byte-identical.

- [ ] **Step 8: Boot check**

Run: `uv run uvicorn app.main:app --port 8000 &` then `curl -s localhost:8000/health`
Expected: `{"status":"ok","db":"ok"}` — then kill the server.

- [ ] **Step 9: Commit**

```bash
git add backend/app/router.py backend/alembic.ini
git add -u backend/app backend/tests backend/alembic backend/scripts
git commit -m "refactor(backend): complete module-first assembly; add alembic slug file_template"
```

---

### Task 11: Closeout (outside the repo)

- [ ] **Step 1:** Update stale long-term memories (do via assistant memory tool, not file edits): "FastAPI Feature-based Directory Structure" → module-first layout; "Layered Architecture & Model Separation" → layering now lives inside each domain package (router/service/repository/models/schemas); "FastAPI Artist Marketplace Backend Architecture" → module-first domains list.
- [ ] **Step 2:** Offer merge/PR via finishing-a-development-branch convention (Conventional Commits already satisfied).

## Self-review notes

- Spec coverage: Part A → Task 2; Part B → Tasks 3–10 (every mapping in the spec tree appears in DOMAINS table + git mv steps); Part C steps 1–7 → Tasks 1, 3, 10; verification gates → Task 10 Step 7–8; memory housekeeping → Task 11.
- Known deviation from spec text: none. Spec's `review/router.py` caveat resolved: file inspection confirmed no standalone user-facing review router exists, so the review package has `artist_router.py` + `admin_router.py` only (Task 8).
