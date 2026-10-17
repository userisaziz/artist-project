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
- Generate with descriptive slug: `alembic revision --autogenerate -m "<what changes>"` → filename `YYYY-MM-DD_<slug>.py` (set via `file_template` in alembic.ini).

## Tests
- Async client only: `httpx.AsyncClient` + `ASGITransport` (already the harness in `tests/conftest.py`) — never sync TestClient.
- Swap auth/external deps via `app.dependency_overrides`, never monkeypatch internals.
- Every behavior change ships with a test in `tests/` (flat layout, file per domain).

## Lint
- `ruff check` + `ruff format` gate every commit; ruff replaces black/isort/autoflake.
