# Approved Backend Library Stack

One kit per capability. Statuses: **installed** (in `requirements.txt`/`requirements.lock`),
**built-in** (FastAPI/Starlette/stdlib, no dependency), **own code** (implemented in
`app/core`/`app/shared` — a third-party kit for the same job is a rival, not an addition),
**candidate** (pre-approved when the need is real), **rejected** (surveyed from the two awesome
lists and deliberately not used).

Sources: [mjhea0/awesome-fastapi](https://github.com/mjhea0/awesome-fastapi) `38e525e`,
[vinta/awesome-python](https://github.com/vinta/awesome-python) `732d491`.

## HTTP edge and framework

| Capability | Pick | Status | Notes |
| --- | --- | --- | --- |
| API framework | FastAPI 0.143.3 (+ Starlette 1.8.0) | installed | Never pin Starlette on its own |
| ASGI server | uvicorn 0.54.0 `[standard]` | installed | `--reload` in dev, `--workers` in Docker, `--proxy-headers` + `--no-server-header` |
| Dev/run CLI | `uvicorn app.main:app` | built-in | `fastapi dev` unavailable — `fastapi-cli` not installed; no `pyproject.toml` |
| CORS / gzip / trusted host | `CORSMiddleware`, `GZipMiddleware`, `TrustedHostMiddleware` | built-in | wired in `app/main.py` |
| Security headers | `app/core/middleware.py` → `SecurityHeadersMiddleware` | own code | rivals `TypeError/secure`, `rennf93/fastapi-guard` — rejected; would duplicate the existing header block |
| Request id + access log | `app/core/middleware.py` → `RequestContextMiddleware`, pure ASGI | own code | pure ASGI on purpose (streaming + background tasks + contextvar visibility). Rival `asgi-correlation-id` rejected |
| Body size limit | `BodySizeLimitMiddleware` | own code | rival: none needed |
| Error contract | `app/core/exceptions.py` + `error_handlers.py` + `app/shared/responses.py` (`errors(401, 404, …)`) | own code | one `{code, message}` shape, documented in OpenAPI |
| Rate limiting | `app/core/rate_limit.py` — fixed window **in Postgres** | own code | counters shared across workers by design. Rivals `slowapi`, `fastapi-limiter` rejected: both want Redis/in-memory, which would break multi-worker sharing |
| Metrics | `app/core/metrics.py` — `prometheus-client` 0.21+ | installed | multiprocess via `PROMETHEUS_MULTIPROC_DIR`; labelled per route template, never raw path. Rivals `prometheus-fastapi-instrumentator`, `starlette-exporter`, `starlette-prometheus` rejected |
| Liveness / readiness / metrics endpoints | `app/health/` (+ `metrics_router`) | own code | Docker `HEALTHCHECK` hits `/health/live` |
| Docs exposure | `openapi_url`/`docs_url` gated on `settings.docs_enabled` | built-in | off in production — rules §Docs/security |
| SSE / streaming | `fastapi.sse.EventSourceResponse` if ever needed | built-in | see `fastapi/references/streaming.md`; nothing in `app/` streams today |
| Serve a built SPA | not applicable | rejected | `app.frontend()` unused; `admin/` deploys separately |

## Data layer

| Capability | Pick | Status | Notes |
| --- | --- | --- | --- |
| ORM | SQLAlchemy 2.1.5 `[asyncio]`, `Mapped`/`mapped_column` | installed | declarative, explicit `MetaData` naming convention in `app/shared/models.py` |
| DB driver | asyncpg 0.32.0 | installed | Postgres only |
| Migrations | Alembic 1.20.0 | installed | 39 revisions, `file_template = YYYY-MM-DD_slug`, static + reversible, verified from empty DB in CI, `alembic check` gate |
| Query building | SQLAlchemy Core expressions (`select`, `text`, `json_build_object`) | installed | rules: SQL-first, Pydantic-second |
| Keyset pagination | `app/shared/pagination.py` | own code | `(timestamp, id)` keyset — new rows never shift pages |
| Opaque cursors | `app/shared/cursor.py` (`base64url`) | own code | rival `uriyyo/fastapi-pagination` rejected: it would replace both modules and its page shapes leak into the API contract |
| Full-text / search | `app/shared/search.py` | own code | Postgres `ILIKE`/trigram-level; rival: a real text-search engine is a project, not a pip install |
| Schema validation | pydantic 2.14.1 | installed | one base `APIModel`, response-off-ORM base `ORMModel` (`from_attributes=True`) in `app/shared/schemas.py` |
| Settings | pydantic-settings 2.16.0 | installed | global `app/core/config.py` + per-domain `config.py` getters, all built at boot |
| Geospatial helpers | `app/shared/geo.py` + Postgres | own code | rival: `pyproj`/`shapely` only if real projections/distances appear |
| Object storage | boto3 1.43 (S3-compatible → Cloudflare R2) | installed | Files never transit the API: the app asks for a **presigned PUT** URL and uploads direct (`app/upload/service.py`, blocking client wrapped in `run_in_threadpool`). Consequence: no `Form`/`File` endpoints, so `python-multipart` is correctly absent — adding a multipart route means adding it as a *runtime* dep, not a dev one |
| Caching | none | candidate | `cachetools` for in-process (note: per uvicorn worker, so no cross-worker dedup), `hishel` for RFC-9111 caching of outbound httpx calls. Redis-backed response caching needs Redis first (see queue row) |
| Rivals in the ORM list | SQLModel, Tortoise, Piccolo, ormar, GINO, Edgy, peewee, FastSQLA, encode/databases | rejected | each one means rewriting `app/*/models.py` + all 39 migrations |

## Auth and security

| Capability | Pick | Status | Notes |
| --- | --- | --- | --- |
| Tokens | PyJWT 2.15.1 | installed | own session/OTP flow in `app/auth/`; `HTTPBearer` in `app/core/auth.py` |
| OTP / refresh-token digests | `hmac` + `hashlib` + `secrets` (stdlib) | built-in | `app/core/security.py`: keyed HMAC-SHA256 for low-entropy 6-digit OTPs, plain SHA-256 for high-entropy refresh tokens. There are no passwords (phone + OTP), so `bcrypt`/`argon2-cffi` have no job here |
| Role gates | `require_role()` → `current_artist` / `current_customer` / `current_admin` | own code | `app/core/auth.py`; `audited_admin` wraps the admin gate with the audit write |
| Crypto (Aadhaar) | cryptography 50.0.2 | installed | `app/core/crypto.py`; key from env, refused at boot if unsafe |
| Audit trail | `app/core/audit.py` | own code | |
| Email/phone validation | email-validator 2.3.0 (`EmailStr`) | installed | validate in schemas, not services |
| Auth framework | none | rejected | `fastapi-users`, `AuthX`, `fastapi-simple-security`, `fastapi-jwt-auth`, `fastapi-cloudauth` rejected — the OTP + session + role model here (`current_customer`, `current_artist`, admin role via `scripts/make_admin.py`) is already owned and matched to the mobile contract |
| Dependency injection frameworks | none | rejected | `modern-di`, `Wireup` — FastAPI's own `Depends` chaining is the rule (§Dependencies) |
| Secret/dep scanning | `pip-audit` 2.7+ | installed (dev) | runs in CI against the lock. `bandit` is **not** needed — `ruff.toml` selects the `S` ruleset, which is bandit's rule set |

## Background work and scheduling

| Capability | Pick | Status | Notes |
| --- | --- | --- | --- |
| Short in-process follow-ups | `fastapi.BackgroundTasks` | built-in | only <1 s and droppable — rules §Background work |
| Durable job queue | none | candidate | **the real gap.** `taskiq` (native asyncio, pluggable broker) or `dramatiq`; `celery`/`rq`/`huey` are the sync-first alternatives. Any of these also pulls in a broker (Redis/AMQP) that is not deployed yet — own change, own review |
| Periodic jobs | `scripts/maintenance.py`, run by platform cron | own code | docstring says "run from a scheduler (cron, Kubernetes CronJob…)"; nothing schedules it in-repo. Do **not** add `apscheduler`/`schedule` in-process: `--workers N` runs it N times |
| Websockets / pub-sub | none | rejected | `fastapi-socketio`, `fastapi-websocket-pubsub` — chat is `app/chat/` over HTTP today; adding a transport is an architecture decision |
| Event buses | none | rejected | `fastapi-events`, `fastapi-cloudevents`, `faststream` — premature until the queue exists |

## Testing and quality

| Capability | Pick | Status | Notes |
| --- | --- | --- | --- |
| Test framework | pytest 8+ with `asyncio_mode = auto` | installed (dev) | 46 flat test files, one per domain |
| Async HTTP harness | `httpx.AsyncClient` + `ASGITransport` | installed (dev) | `tests/conftest.py`; never sync `TestClient` |
| Dependency swapping | `override` fixture → `app.dependency_overrides` | own code | `travel` fixture moves the injected `Clock` |
| Coverage | `pytest-cov` / coverage 6+, `fail_under = 90`, branch = true | installed (dev) | `.coveragerc` excludes `if TYPE_CHECKING:` and `raise NotImplementedError` |
| Outbound-HTTP mocks | `httpx.MockTransport` (2 files today) | candidate | upgrade to `respx` for route matching/assertions; `providers` take a `transport=` injection point already, so this is a test-only change |
| Property-based tests | `hypothesis` | candidate | fits `app/booking/rules.py`, `app/shared/cursor.py`, `app/shared/geo.py`, quote pricing |
| Fixture/factory generation | `polyfactory` | candidate | Pydantic-native (`pydantic-factories` successor), better than `faker` for typed API models |
| API schema fuzzing | `schemathesis` | candidate | runs against the OpenAPI doc; useful pre-release, not part of the current gate |
| Load testing | `locust` | candidate | outside CI; run ad hoc against staging |
| Time travel | own `Clock` + `travel` | own code | rival `time-machine` rejected — mocking the C-level clock bypasses the seam the design deliberately exposes |
| Architecture lint | `import-linter` | candidate | enforces module-first boundaries (`app/X` internals, service↛router) that review enforces today; analogue of `eslint-plugin-boundaries` on mobile |
| Dead code | `vulture` | candidate | occasional sweep, not a gate |

## Tooling and language

| Capability | Pick | Status | Notes |
| --- | --- | --- | --- |
| Lint + format | ruff `==0.17.3` (exactly pinned) | installed (dev) | rules `E4,E7,E9,F,B,I,RUF,S,ASYNC,UP,SIM`, line-length 120; `ASYNC` is what stops blocking calls inside `async def`; `extend-immutable-calls` whitelists the `Depends()` idiom |
| Type checking | mypy `==2.4.1` (exactly pinned) | installed (dev) | `mypy.ini`; `dmypy` is available for iterative runs |
| Concurrency | `asyncio` + `run_in_threadpool` | built-in | rival Asyncer rejected; trio/gevent not applicable |
| Async primitives | `asyncio.TaskGroup`, `asyncio.timeout` (3.14) | built-in | prefer over `gather(..., return_exceptions=True)` for new fan-out |
| Date/time | `datetime` + `zoneinfo` | built-in | UTC everywhere; `_at`/`_date` naming per rules §Database. Rivals `pendulum`, `whenever`, `dateutil` rejected |
| Structured logging | stdlib `logging` + own `JsonFormatter` | own code | rivals `structlog`, `loguru` rejected; `logfire` would be a platform decision, not a logger swap |
| Serialisation | pydantic (Rust) + `json` | installed | `orjson`, `msgspec`, `msgpack-asgi` rejected — a second content type is a client-visible contract change |
| Script CLIs | `sys.argv` in `scripts/` | own code | `typer`/`click`/`argparse` only if scripts grow flags; today two scripts read one positional each |
| Task runner | `dev.sh` + documented commands | own code | `poethepoet`/`invoke`/`nox`/`tox` rejected — the gate list in SKILL.md is short enough to type |
| Env files | `python-dotenv` (via pydantic-settings / uvicorn) | installed | `.env`, `.env.dev`, `.env.prod`, `.env.example` |
| Packaging | application, not a library | n/a | no `pyproject.toml`/build backend; uv/`ty` from the lists are not adopted — pip + lock is the current, working shape |

## Refresh recipe

```bash
git clone --depth 1 https://github.com/vinta/awesome-python.git /tmp/ap
git clone --depth 1 https://github.com/mjhea0/awesome-fastapi.git /tmp/afa
```

Read awesome-python's sections *Web APIs, ORM, Database, Caching, Data Validation, Testing, Code
Analysis, Debugging Tools, Task Queues, Logging, Date and Time, Asynchronous Programming*;
read awesome-fastapi's *Databases, CyberSecurity, Utils, Developer Tools, Email*. Then for each
row above: confirm the pick is still maintained, check the item is not already **own code**, and
verify the exact PyPI name before writing it into the table. Record both commit SHAs in
`SKILL.md` and this file when they change.
