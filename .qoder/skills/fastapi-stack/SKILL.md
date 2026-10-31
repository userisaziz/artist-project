---
name: fastapi-stack
description: Picks and governs libraries for the GetReady backend (backend/, FastAPI 0.143 + SQLAlchemy 2 async + Postgres + uvicorn) with a capability-first decision ladder, an approved one-kit-per-capability table, and the reconciliations where the vendored official `fastapi` skill disagrees with this repo's rules. Use when choosing, adding, upgrading or removing any dependency in backend/requirements*.txt, when deciding how to implement a backend capability (rate limiting, pagination, logging, jobs, caching, auth, testing, observability), or when reviewing backend code for a competing or redundant library.
license: MIT
---

# FastAPI / Python Backend Stack (backend/)

Curated against [mjhea0/awesome-fastapi](https://github.com/mjhea0/awesome-fastapi)
(commit `38e525e`) and [vinta/awesome-python](https://github.com/vinta/awesome-python)
(commit `732d491`), then filtered to what this API actually needs. The approved table is
[LIBRARIES.md](./LIBRARIES.md).

`.qoder/rules/fastapi-best-practices.md` is the hard law (module-first layout, async decision
table, thin routes, SQL-first, always `response_model`, Alembic reversibility, async test
harness, ruff gate). Where a rule or this skill disagrees with the vendored official `fastapi`
skill, the rule wins — the conflicts are listed below so nobody rediscovers them.

## The defining fact about this backend

`backend/requirements.txt` contains **no third-party FastAPI or Starlette extensions at all**.
Every HTTP-edge capability is owned in-house: `app/core/` (12 modules — config, database,
security, auth, crypto, audit, logging, middleware, error_handlers, exceptions, metrics,
rate_limit) and `app/shared/` (9 modules — models, schemas, enums, pagination, cursor, search,
responses, clock, geo). 23 domain packages under `app/` and 243 Python files run on that.
`requirements.txt` is 13 ranged runtime dependencies and nothing more.

So the ecosystem lists are mostly a list of **rivals to our own code**, not candidates.
Adopting one means deleting our version in the same change, never installing it next to it.

## Decision ladder — run in order, stop at the first hit

1. **Python standard library.** `datetime` + `zoneinfo`, `logging`, `contextvars`,
   `dataclasses`, `typing.Protocol`, `base64`, `secrets`, `hashlib`. This app leans on these
   hard — `app/shared/clock.py` is a `Protocol`, `app/core/logging.py` is stdlib `logging` with
   a `ContextVar` request id, `app/shared/cursor.py` is `base64`.
2. **Something already in `app/core/` or `app/shared/`.** Paging, cursors, error contracts,
   security headers, request ids, access logs, metrics, rate limits, JSON logging and the clock
   all exist. Extend that module; do not add a middleware from the list.
3. **A FastAPI/Starlette built-in.** `CORSMiddleware`, `GZipMiddleware`,
   `TrustedHostMiddleware`, `BackgroundTasks`, `Depends` chaining, `run_in_threadpool`
   (used in `app/upload/service.py` for the blocking boto3 delete).
4. **An installed dependency.** All thirteen are listed in `requirements.txt`, exact versions in
   `requirements.lock`. Reuse before adding — e.g. `httpx` already covers outbound HTTP
   (`app/auth/sms.py`, `app/notification/push.py`, `app/geocoder/service.py`), `cryptography`
   covers Aadhaar encryption, `boto3` covers R2.
5. **A row in [LIBRARIES.md](./LIBRARIES.md)** marked `candidate`. Pre-approved for that
   capability — install it, do not re-survey the ecosystem.
6. **Only then** propose a new dependency, and record it in LIBRARIES.md **and** in
   `.qoder/rules/fastapi-best-practices.md` in the same change. If the capability already has an
   owner in `app/core`, the answer is *no* unless the change removes the owner.

## Where the vendored official skill disagrees with this repo

The `fastapi` skill is vendored from the installed wheel (see provenance there). It is
authoritative on FastAPI *API surface*; it is not authoritative on *this stack*.

| Official skill says | Here | Why |
| --- | --- | --- |
| Prefer a return type; use `response_model` only when the schema differs | Keep `response_model=` on routes (192 sites in 39 files), plus a `-> dict` annotation for mypy. Of the 209 routes, only the 14 that answer `204 No Content` carry no schema — correct, they have no body | Rules §REST mandate it, and services return dicts/ORM rows — `response_model` is what filters and validates; the `-> dict` annotation is documentation only. Response schemas that read ORM rows extend `ORMModel` (`from_attributes=True`) |
| Don't pre-instantiate the returned model | Same — matches rules §REST exactly | Returning a constructed model makes FastAPI revalidate it |
| "SQLModel — prefer it over SQLAlchemy" | **Rejected.** SQLAlchemy 2.1.5 async + asyncpg 0.32 + Alembic 1.20, 39 reversible migrations | Adopting SQLModel is a rewrite of every `models.py`, not an addition |
| "Asyncer — prefer it over AnyIO or asyncio" | **Rejected.** Plain `async def` + `run_in_threadpool` for blocking I/O | `anyio` is present only as a transitive dep of Starlette/httpx; Asyncer would be a second concurrency layer |
| Use the `fastapi` CLI (`fastapi dev`, `[tool.fastapi]` in pyproject) | **Not available.** `.venv/bin/fastapi` is a stub that exits with a hint to `pip install fastapi[standard]`; `fastapi-cli` is not installed | The server is uvicorn everywhere: `uvicorn app.main:app --reload` (`dev.sh`), `--workers ${WEB_CONCURRENCY}` (Dockerfile), `alembic upgrade head && uvicorn` (render.yaml). There is no `pyproject.toml` |
| OpenTelemetry auto-configure (`FASTAPI_OTEL_AUTO_CONFIGURE`) | Do not enable blind. `opentelemetry-api` 1.45.1 is installed because FastAPI now requires it, but there is **no SDK, no exporter, no collector** — the skill itself says those come from `fastapi[standard]` | Observability here is `app/core/metrics.py` (prometheus-client, multiprocess) + JSON access logs with request ids. Adding OTel is a project, not a flag. Note the same extra also delivers the `fastapi` CLI above: if `fastapi[standard]` is ever adopted, revisit both rows together |
| `app.frontend()` / `router.frontend()` to serve a built SPA | Not used | `admin/` is a separate Vite SPA on Vercel; the API serves JSON only, `openapi_url` is gated off in production |
| "In case of doubt, or by default, use regular `def`" | All 209 routes are `async def`, and that is not a guess | The doubt is resolved up front by rules §Async decision table: the I/O here is asyncpg through an async engine, so `async def` is the correct rung, not an assumption. Blocking work (boto3) goes through `run_in_threadpool` or a sync dependency |
| Always use `Annotated` for parameters and dependencies | **Adopt for new code**, don't sweep existing routes | Only 13 files use `Annotated[` today; routers write `user: User = Depends(current_customer)`. Converting a file while touching it is fine; a repo-wide typing PR is not this task |
| No `ORJSONResponse`/`UJSONResponse` | Not installed, not needed | Pydantic v2 serialises in Rust once a `response_model` is declared |

Add a row here the moment a new disagreement is found — that is the point of vendoring upstream
instead of paraphrasing it.

## Version floors and pairing

Do not upgrade a member of a pair alone.

- `fastapi` 0.143.3 ⟷ `starlette` 1.8.0 — Starlette is FastAPI's, never pin it separately.
- `pydantic` 2.14.1 ⟷ `pydantic-settings` 2.16.0 ⟷ `email-validator` 2.3.0.
- `sqlalchemy[asyncio]` 2.1.5 ⟷ `asyncpg` 0.32.0 ⟷ `alembic` 1.20.0; `Greenlet` is a real
  runtime requirement of the async engine, keep it in the lock.
- `uvicorn[standard]` 0.54.0 brings `uvloop`, `httptools`, `watchfiles`, `websockets` and
  `python-dotenv` — that is where `watchfiles` in `.venv/bin` comes from, not from a direct need.
- `ruff==0.17.3` and `mypy==2.4.1` are **pinned exactly** in `requirements-dev.txt`, unlike the
  ranged runtime deps: lint/format output is a gate, so it must not move underneath a review.
- Python is 3.14 (`.venv/bin/python3.14`); modern syntax is available — `X | None`,
  `StrEnum`, `asyncio.timeout`, and no `typing.Optional`/`Dict` in new code.

## Adding a dependency

```bash
cd backend
# 1. edit requirements.txt (a >= floor, in the style already there)
# 2. regenerate the lock in a CLEAN venv — never freeze the dev venv, it carries dev deps:
python -m venv /tmp/lock
/tmp/lock/bin/pip install -r requirements.txt
/tmp/lock/bin/pip freeze --exclude pip > requirements.lock    # keep the header comment
# 3. audit what you just added
.venv/bin/pip-audit -r requirements.lock --progress-spinner off
```

Anything that *is* a gate (linter, type checker, scanner) stays exactly pinned in
`requirements-dev.txt` (`==`), unlike the ranged runtime deps. `Dockerfile` and CI install
`requirements.lock`, so an install that never lands in the lock file will not reach production.

## Gates before finishing in `backend/`

```bash
cd backend
.venv/bin/ruff check .
.venv/bin/ruff format --check .
.venv/bin/mypy
.venv/bin/alembic check            # models and migrations agree (after any models.py change)
.venv/bin/pytest -q --cov=app --cov-report=term-missing:skip-covered   # fail_under = 90, branch coverage
```

`ruff check`/`format --check` also runs in `.husky/pre-commit` whenever staged paths are under
`backend/`. CI (`.github/workflows/backend.yml`) additionally runs `pip-audit`, verifies
migrations build an empty database and reverse cleanly, and runs the production image smoke
test. Coverage floor is 90 % with branches (`.coveragerc`) — a new module without tests can
fail the gate on its own.

Every behavior change ships a test in `tests/` (46 files, flat, one per domain). The harness in
`tests/conftest.py` is `httpx.AsyncClient` over `ASGITransport` with two fixtures — use them
rather than hand-rolling: `override` swaps a FastAPI dependency (auth, SMS, storage, payments)
through `app.dependency_overrides` and restores it afterwards, and `travel` moves the injected
`Clock`. The suite forces `ENVIRONMENT=test`, console SMS, fake storage and mock payments, so a
test that reaches a real provider means the fixture was bypassed, not overridden.

## Known gaps worth acting on

Ranked by structural payoff; details and commands in [LIBRARIES.md](./LIBRARIES.md).

1. **Real queue.** Rules §Background work says `BackgroundTasks` is only for <1 s droppable
   tasks and "if losing the task would page someone → real queue (not built yet; do not add
   silently)". Nothing in `requirements.txt` is a broker. Pre-approved first look: `taskiq`
   (native asyncio, pluggable broker) or `dramatiq`; both need Redis or an AMQP, which is also
   absent. This is the one dependency class that changes the deployment shape — plan it as its
   own work item, not as a drive-by install.
2. **Periodic execution.** `scripts/maintenance.py` is explicitly written to be run by cron or
   a CronJob every few minutes, and CI only smoke-runs it. There is no scheduler in the repo
   (`keep-warm.yml` is a `*/10 * * * *` ping, not the housekeeping job). Either wire it to the
   platform's cron or accept the missed run knowingly — do not add `apscheduler` in-process,
   because `--workers N` would run it N times.
3. **Outbound-HTTP test doubles.** `app/auth/sms.py`, `app/notification/push.py` and
   `app/geocoder/service.py` all call third parties with `httpx`; only 2 test files
   (`test_geocoder.py`, `test_notifications.py`) stub the transport with `httpx.MockTransport`.
   `respx` is the curated upgrade for route-style mocking and assertions; it is a test-only dep
   and belongs in `requirements-dev.txt`.
4. **Architecture lint.** Module-first boundaries (`app/X` must not import `app/Y`'s internals,
   `service` must not import `router`) are enforced by review only. `import-linter` is the
   pre-approved tool — the direct backend analogue of `eslint-plugin-boundaries` on mobile.
5. **Property-based tests.** `hypothesis` for the pure logic that deserves it
   (`app/booking/rules.py`, `app/shared/cursor.py`, `app/shared/geo.py`, pricing in
   `app/quote`). `polyfactory` can fill Pydantic-out-of-thin-air fixtures for seed scripts.
6. **Profiling in production-like runs.** No `py-spy` / `memray` / `pyinstrument`. The uvicorn
   image is multi-worker, so a sampling profiler that attaches to a live PID is the least
   invasive first step.
7. **Admin surface.** `admin/` is a hand-built React SPA over the API. `sqladmin` from both
   lists is a **rejected** rival — an ORM-bypassing admin panel over the same tables would
   undercut the role checks in `app/*/admin_router.py`.

Do not bundle these into one change. One capability per commit, dependency and all.

## Which skill to load

FastAPI code shape (Pydantic models, `Annotated`, dependencies, `response_model`, SSE, routers,
serving frontends) → `fastapi`, and read its `references/` for the specific area before writing.
Architecture/layout/async decisions and the full library governance → this skill, then
`.qoder/rules/fastapi-best-practices.md`. Runtime and deployment of the service (monitoring,
alerts, host troubleshooting) → `team-ops-expert`. Test-case design → `qa-quality` / `test-case`.
