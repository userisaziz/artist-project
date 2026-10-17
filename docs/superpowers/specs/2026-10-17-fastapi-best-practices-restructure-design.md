# FastAPI Best Practices: Rules Adoption + Backend Module-First Restructure

Date: 2026-10-17
Status: awaiting user review
Source: https://github.com/zhanymkanov/fastapi-best-practices (README.md + AGENTS.md)

## Summary

Two deliverables, one change set:

1. **Rules adoption** — encode the repo's opinionated FastAPI best practices as
   standing instructions for Qoder (`.qoder/rules/`), Claude Code in this project
   (root `CLAUDE.md`), and Claude Code globally (`~/.claude/CLAUDE.md`).
2. **Backend restructure** — migrate `backend/app/` from the current layer-first
   layout (`routes/` + `controllers/` + `services/` + `repositories/` + `schemas/` +
   `models/`, each with domain sub-packages, plus orphaned `api/v1/` files) to the
   repo's **module-first** layout: one package per domain owning its router,
   schemas, models, service, dependencies.

Hard constraint: **no API contract changes**. Every URL, method, status code, and
response schema stays identical; only Python module paths move.

## Part A — Rules documents

Base text: the repo's `AGENTS.md` (machine-readable: version matrix, Do/Don't
blocks, anti-pattern checklist), supplemented by README.md prose where a rule
needs rationale. Language: en-us, imperative, terse.

| File | Role | Content |
|---|---|---|
| `.qoder/rules/fastapi-best-practices.md` (new, project) | Qoder rule, frontmatter `trigger: glob`, `globs: backend/**/*.py` | Full ruleset (see checklist below) |
| `CLAUDE.md` (new, project root) | Claude Code, this repo | Same ruleset + pointer to the restructured backend layout |
| `~/.claude/CLAUDE.md` (create; currently does not exist) | Claude Code, global | Terse version, scoped "when working on FastAPI projects" |

Ruleset checklist (each a section in the docs):

- [ ] Project structure: module-first, per-domain router/schemas/models/service/
      dependencies/constants/exceptions/utils; global config/models/exceptions/
      database/pagination at app root; explicit-module cross-domain imports
- [ ] Async routes: decision table (async I/O → `async def`; blocking → sync `def`
      or `run_in_threadpool`; CPU-bound → worker process)
- [ ] Pydantic: use excessively; one custom global base model; decouple
      BaseSettings per module (our compromise: keep `core/config.py` global,
      allow per-module `config.py`)
- [ ] Dependencies: validation-in-dependency, chained dependencies, per-request
      result caching, prefer `async` dependencies
- [ ] REST: consistent path variable names across domains to enable dependency
      chaining
- [ ] Response serialization cost: don't pre-build `response_model` instances
      just to return them
- [ ] Sync SDKs → `run_in_threadpool`; `BackgroundTasks` only for short,
      droppable, in-process tasks (else real queue)
- [ ] Docs: hide OpenAPI docs outside local/staging; set `response_model`,
      `status_code`, `description`, `tags`, `responses`
- [ ] DB: naming conventions (snake_case, singular, module prefix, `_at`/`_date`),
      explicit Postgres index naming convention in `MetaData`
- [ ] Migrations: static + reversible, descriptive slugs,
      `file_template = %%(year)d-%%(month).2d-%%(day).2d_%%(slug)s`
- [ ] SQL-first, Pydantic-second
- [ ] Tests: async `httpx.ASGITransport` client from day 0;
      `app.dependency_overrides` instead of monkeypatching
- [ ] Lint/format: ruff

Existing project conventions that survive (documented in the rules files so future
sessions apply them together): thin routes delegating to services, model/schema
separation, `{code, message}` AppError contract.

## Part B — Target backend structure

Package name stays `app/` (renaming to `src/` churns uvicorn/alembic/pytest
config for zero benefit). `core/` and `shared/` stay as global packages (same
concept as the repo's root-level `config.py` / `models.py` / `pagination.py`,
just grouped). Each domain keeps an optional `repository.py` (data access) so the
service = business logic / repository = queries discipline survives inside modules.

```
backend/app/
├── main.py                    # unchanged role (app factory)
├── router.py                  # NEW: api_router(/api/v1) assembly (← routes/__init__.py), include order preserved
├── registry.py                # keeps working; imports updated to <domain>.models
├── core/                      # UNCHANGED: config, database, security, crypto, exceptions, auth
├── shared/                    # UNCHANGED + schemas.py (← schemas/common.py)
├── scripts/                   # UNCHANGED: make_admin.py
├── auth/
│   ├── router.py              # ← routes/auth/auth.py + controllers/auth/auth.py (inlined)
│   ├── dependencies.py        # ← controllers/auth/dependencies.py
│   ├── service.py             # ← services/auth/auth.py
│   ├── sms.py                 # ← services/auth/sms.py
│   ├── repository.py          # ← repositories/auth/auth.py
│   ├── models.py              # ← models/auth/auth.py
│   └── schemas.py             # ← schemas/auth/auth.py
├── user/                      # same shape: router, dependencies, service, repository, models, schemas
├── catalog/
│   ├── router.py              # ← routes/catalog/catalog.py + controllers/catalog/catalog.py
│   ├── admin_router.py        # ← routes/catalog/admin.py + controllers/catalog/admin.py
│   ├── dependencies.py, utils.py (← presenters.py), service.py (← services/catalog/catalog.py),
│   ├── template.py            # ← services/catalog/template.py
│   ├── repository.py, models.py, schemas.py
├── artist/
│   ├── router.py              # ← routes/artist/artist.py + controllers/artist/artist.py
│   ├── admin_router.py        # ← routes/artist/admin.py + controllers/artist/admin.py
│   ├── dependencies.py, utils.py (← presenters.py)
│   ├── service.py             # ← services/artist/artist.py
│   ├── admin_service.py       # ← services/artist/admin.py
│   ├── aadhaar.py             # ← services/artist/aadhaar.py
│   ├── custom_service_review.py
│   ├── repository.py, models.py, schemas.py
├── booking/                   # NEW domain package (absorbs orphans)
│   ├── router.py              # ← api/v1/bookings.py
│   ├── artist_router.py       # ← api/v1/artist_bookings.py
│   ├── admin_router.py        # ← api/v1/admin_bookings.py + services/admin_booking_service.py consumers
│   ├── service.py             # ← services/booking_service.py
│   ├── admin_service.py       # ← services/admin_booking_service.py
│   ├── rules.py               # ← utils/booking_rules.py
│   ├── models.py              # ← models/booking.py
│   └── schemas.py             # ← schemas/booking.py
├── review/                    # NEW domain package
│   ├── router.py              # ← api/v1/artist_reviews.py (user-facing portion if separate, see note)
│   ├── artist_router.py       # ← api/v1/artist_reviews.py
│   ├── admin_router.py        # ← api/v1/admin_reviews.py
│   ├── service.py             # ← services/review_service.py
│   ├── filters.py             # ← utils/review_filter.py
│   ├── models.py              # ← models/review.py
│   └── schemas.py             # ← schemas/review.py
├── directory/                 # NEW domain package
│   ├── router.py              # ← api/v1/directory.py
│   ├── service.py             # ← services/directory_service.py
│   └── schemas.py             # ← schemas/directory.py
└── upload/
    ├── router.py              # ← routes/upload/upload.py + controllers/upload/upload.py
    ├── service.py             # ← services/upload/storage.py
    └── schemas.py             # ← schemas/upload/upload.py
```

Note for `review/router.py`: `api/v1/` has no user-facing reviews router — reviews
are created via booking endpoints and artist/admin routers handle the rest. If
inspecting the actual files shows no standalone user router exists, the package
gets only `artist_router.py` + `admin_router.py`. Implementation must map by
reading the files, not by assuming this tree.

Deleted after migration: `app/api/`, `app/controllers/`, `app/routes/`,
`app/services/`, `app/repositories/`, `app/schemas/`, `app/models/`, `app/utils/`
(everything they contain moved into domain packages or `shared/`).

## Part C — Migration mechanics

1. Branch `backend-module-first-restructure` from current backend state.
2. Snapshot `/openapi.json` from the pre-refactor app (baseline artifact).
3. Per domain: `git mv` + inline controllers into routers (bodies of the thin
   controller functions moved into the route functions that called them; no logic
   edits).
4. Mechanical import rewrite across `app/`, `tests/`, `alembic/env.py`,
   `app/registry.py`. Cross-domain imports use explicit module form
   (`from app.auth import service as auth_service` style per the rules).
5. `alembic.ini`: add `file_template = %%(year)d-%%(month).2d-%%(day).2d_%%(slug)s`.
6. Tests keep their flat `tests/` layout (import updates only).
7. Write the three rules documents (Part A).

## Verification (all gates must pass)

- `uv run pytest` — full suite green (real Postgres harness, unchanged)
- `ruff check` — clean
- `/openapi.json` post-refactor vs baseline: identical set of paths/methods/
  response models (ordering aside) — proves zero user-facing change
- App boots: `uv run uvicorn app.main:app` reaches `/health` with `db: ok`

## After merge — memory housekeeping

Update the now-stale long-term memories so future sessions don't re-apply the
old scheme: "FastAPI Feature-based Directory Structure", "Layered Architecture &
Model Separation" (layering now lives inside each domain package), and the
backend-architecture introduction memory.

## Risks

- **Circular imports** during controller-inlining and re-export pruning — caught
  immediately by pytest collection.
- **Alembic metadata incompleteness** if a model import is missed in `registry.py`
  — caught by comparing autogenerate diff (must stay empty) and openapi/health gates.
- **`"me"` route ordering**: the directory router must remain included after all
  `/artists/me…` routers; include order is preserved verbatim.
