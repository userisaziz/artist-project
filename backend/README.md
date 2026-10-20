# Art Circle API

FastAPI backend for Art Circle: phone + OTP auth, JWT access/refresh tokens, and account onboarding. It runs on async SQLAlchemy over PostgreSQL, with Alembic migrations.

## Setup

Prerequisites: Python 3.14 and a local PostgreSQL server (for example `brew install postgresql@16 && brew services start postgresql@16`).

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt   # the locked runtime deps + test/lint tools
cp .env.example .env
createdb art_circle
createdb art_circle_test      # used by pytest
alembic upgrade head
uvicorn app.main:app --reload # add --host 0.0.0.0 to reach it from a phone on your LAN
```

Check that it's running: `curl localhost:8000/health/ready` should return `{"status":"ok","db":"ok"}`. Interactive API docs are at http://localhost:8000/docs.

## Configuration (`.env`)

Global settings live in `app/core/config.py`; each domain keeps its own in `app/<domain>/config.py` (auth, booking, catalog, review, upload). All of them are built when the app starts, so a missing or unsafe value stops the boot.

`ENVIRONMENT` defaults to `production`. Production refuses console SMS, fake storage and mock payments, and hides the API docs.

| Variable | Default | Notes |
|---|---|---|
| `ENVIRONMENT` | `production` | `local`, `test`, `staging` or `production`. Set `local` on a dev machine |
| `DATABASE_URL` | required | `postgresql+asyncpg://...` |
| `TEST_DATABASE_URL` | tests only | Separate database. Tests truncate its tables. The app itself never reads it. |
| `JWT_SECRET` | required | At least 32 characters, or the app won't start. The algorithm is pinned to HS256 |
| `ACCESS_TOKEN_TTL_MINUTES` | `15` | |
| `REFRESH_TOKEN_TTL_DAYS` | `7` | |
| `OTP_TTL_MINUTES` | `5` | |
| `OTP_MAX_ATTEMPTS` | `5` | Wrong guesses allowed before the code is burned |
| `OTP_RESEND_COOLDOWN_SECONDS` | `60` | Faster re-requests get a `429 rate_limited` response |
| `CORS_ORIGINS` | `["http://localhost:5173"]` | Allowed browser origins outside `local` (any origin locally). `ADMIN_ORIGINS` still works |
| `ALLOWED_HOSTS` | `["*"]` | Host headers the API answers to. Production refuses `*` |
| `FORWARDED_ALLOW_IPS` | empty | Proxy/load-balancer addresses trusted for `X-Forwarded-For`. Required in production, or every client shares one rate-limit bucket |
| `METRICS_TOKEN` | unset | Bearer token for `GET /metrics` (16+ chars). Required in production |
| `LOG_LEVEL`, `LOG_JSON` | `INFO`, auto | Logs are JSON everywhere except `local` unless `LOG_JSON` says otherwise |
| `DB_POOL_SIZE`, `DB_MAX_OVERFLOW`, `DB_POOL_RECYCLE_SECONDS`, `DB_STATEMENT_TIMEOUT_MS` | `10`, `10`, `1800`, `15000` | Connection pool and per-statement timeout |
| `SMS_PROVIDER` | `console` | `console` logs OTPs to the server output (not allowed in production); `fast2sms` sends real SMS |
| `FAST2SMS_API_KEY` | empty | Required when `SMS_PROVIDER=fast2sms` |
| `STORAGE_PROVIDER` | `fake` | `fake` (no network, not allowed in production) or `cloudinary`, which needs the three `CLOUDINARY_*` values |
| `PAYMENT_PROVIDER` | `direct` | `direct`: the customer pays the artist's UPI and the platform holds no money. `mock` marks deposits paid and is not allowed in production |
| `PLATFORM_FEE_PAISE`, `PLATFORM_FEE_WAIVED_FROM_PAISE`, `DEPOSIT_PERCENT`, `COMMISSION_PERCENT` | `9900`, `2500000`, `30`, `10` | Booking money; changes apply to new bookings only |
| `BOOKING_ACCEPT_HOURS`, `FREE_CANCEL_HOURS`, `MAX_OPEN_REQUESTS_PER_CUSTOMER` | `3`, `72`, `3` | Booking rules |
| `SLOT_FIRST_HOUR`, `SLOT_LAST_HOUR`, `BOOKING_LEAD_HOURS`, `BOOKING_HORIZON_DAYS` | `9`, `17`, `2`, `60` | Hourly IST start times, earliest start from now, how far ahead |
| `AADHAAR_ENCRYPTION_KEY` | required | Fernet key that encrypts stored Aadhaar numbers; the app won't start without it. Generate one with `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`. Losing it makes stored Aadhaar numbers unrecoverable, so back it up. |

> `.env.example` ships with `ENVIRONMENT=local` and `SMS_PROVIDER=console`: read codes from the uvicorn log (`[console-sms] to=+91... | Your Art Circle code is 123456`).

## API

Every route is under `/api/v1` except the probes: `/health/live` (process up, no database) and `/health/ready` (database reachable, `503` otherwise; `/health` is an alias).

Every response carries an `X-Request-ID` header (a safe one sent by the client is kept) that also appears in every log line, plus security headers. Request bodies over 1 MB get `413`.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/health` | none | App and DB liveness |
| POST | `/auth/otp/request` | none | `{phone}` (E.164). Always returns `204`, so the response doesn't reveal whether the phone is registered. |
| POST | `/auth/otp/verify` | none | `{phone, code}` → `{access_token, refresh_token, token_type, user}`. Creates the user on first sign-in. |
| POST | `/auth/refresh` | none | `{refresh_token}` → new token pair (rotated) |
| GET | `/users/me` | Bearer | Current user |
| PATCH | `/users/me` | Bearer | Sign-up details: `{first_name, last_name?, email?, whatsapp_booking_updates?}` |
| PUT | `/users/me/role` | Bearer | `{role: "customer" \| "artist"}`. Grants the role if new and shows that side; call again to switch. Sets `is_onboarded=true`. |
| PUT | `/artists/me/kyc` | Bearer (artist) | Aadhaar verification: `{aadhaar_number, front_key, back_key}`. The number is validated and stored encrypted; the keys come from `/uploads/signature` with `purpose: "aadhaar"`. |
| POST | `/uploads/signature` | Bearer | With `purpose: "aadhaar"`, signs an upload of an Aadhaar image to private storage. |
| POST | `/admin/artists/{id}/kyc/reveal` | Bearer (admin) | Returns `{aadhaar_number}` in full. Admin-only. Each call is logged in `artist_aadhaar_reveal`, and the response is `Cache-Control: no-store`. |

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

Categories and subcategories have a `status`: `draft` (new ones start here; admin-only), `inactive` (no new picks; artists who have it keep it) or `active` (public and pickable). A subcategory is public only when it and its parent are both active. A category in use can't go back to draft.

Anything in use (a category with artists, services, subcategories or templates; a template an artist offers) can only be hidden, not deleted.

> **Fill in the catalog before artists onboard.** During onboarding, artists can only add services from the admin's list. If a category has no subcategories and services, artists in it can't add a service and can't submit their profile.

### Directory and bookings

Customers find approved artists and request a slot. The artist has 3 hours to answer.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/artists` | none | Approved artists, `?city=&category_id=&q=&limit=&cursor=` → `{items, next_cursor}` |
| GET | `/artists/{id}` | none | Public profile: approved services, portfolio, completed bookings. Never KYC or phone. |
| GET | `/artists/{id}/availability` | none | `?date=YYYY-MM-DD&service_id=` → hourly IST slots with `available` |
| POST | `/bookings` | customer | `{artist_id, service_id, start_at, address, note?}`; amounts are recorded and the customer pays the artist directly (`PAYMENT_PROVIDER=direct`) |
| GET | `/bookings` · `/bookings/{id}` | customer | Own bookings, `?scope=upcoming\|past` |
| POST | `/bookings/{id}/cancel` | customer | `{reason?}`. The deposit is refunded when cancelled 72 h or more ahead. |
| GET | `/artists/me/bookings` | approved artist | `?scope=requests\|upcoming\|past`, or `?from=&to=` (IST dates) for the calendar |
| POST | `/artists/me/bookings/{id}/accept` · `/decline` · `/complete` | approved artist | Decline takes `{reason?}`; complete only after the start |
| GET | `/artists/me/dashboard` | approved artist | Request and upcoming counts, this month's earnings, today's schedule |
| GET | `/admin/bookings` · `/admin/bookings/{id}` | admin | `?status=&q=` (code, customer phone or artist name) |
| POST | `/admin/bookings/{id}/cancel` | admin | `{reason}`; the deposit is always refunded |
| GET | `/admin/overview` | admin | 30-day KPIs and bookings per week for the admin Overview |

**Lifecycle:** `requested` → `confirmed` → `completed`, or `declined`, `expired` or `cancelled`. A request that gets no answer within 3 hours, or by its start time if that comes first, expires the next time anyone reads it. Overlapping requests for one artist are refused (`409 conflict`), and a customer can have at most 3 unanswered requests.

**Money:** all amounts are integer paise and are copied onto the booking. A booking costs the service price plus a ₹99 platform fee, which is waived from ₹25,000. The customer pays a 30% deposit up front, rounded to the rupee. The commission is 10% of the service price, and customers never see it.

> **Payments go straight to the artist.** With `PAYMENT_PROVIDER=direct` (the default) the customer pays the artist's UPI; bookings record the amounts but `deposit_paid_at` stays empty because the platform never sees the money. `mock` marks the deposit paid for dev and tests and is refused in production. Razorpay comes in phase 2.

### Error contract

Every error returns `{"code": "...", "message": "..."}`: domain errors, unknown routes (`not_found`), validation failures (`validation_error`, with FastAPI's `detail` list kept alongside) and unexpected crashes (`internal_error` with the `request_id`, nothing internal leaked). Clients branch on `code` and never on `message`, so treat the codes as part of the API contract (`app/core/exceptions.py`):

| Status | `code` | Example |
|---|---|---|
| 401 | `auth_error` | Invalid or expired OTP, bad refresh token |
| 404 | `not_found` | |
| 409 | `conflict` | Email already in use, role already chosen |
| 413 | `payload_too_large` | Request body over 1 MB |
| 422 | `validation_error` | Body or query failed validation; `detail` lists the fields |
| 429 | `rate_limited` | Cooldown or rate limit hit; see the `Retry-After` header |
| 500 | `internal_error` | Unexpected; quote the `request_id` when reporting |
| 503 | `service_unavailable` | SMS gateway or database unreachable; retry later |

## Project structure

Module-first: one package per domain, each with only the files it needs.

```
app/
  main.py              app factory: settings check, logging, middleware, error handlers, routers
  router.py            mounts every domain router under /api/v1
  registry.py          imports every model so Base.metadata is complete
  core/                global infrastructure: config, database, security (JWT/OTP hashing), auth
                       dependencies, error contract + handlers, middleware, logging, audit, rate limits
  shared/              Base model + naming convention, Pydantic base, enums, clock, pagination, cursors
  health/              liveness and readiness probes
  <domain>/            auth, user, catalog, artist, booking, review, directory, upload
    router.py          thin endpoints: validate via dependencies, call the service
    schemas.py         Pydantic request/response models
    models.py          SQLAlchemy models (tables are <domain>_<thing>, singular)
    service.py         business rules and transactions
    repository.py      queries
    dependencies.py    service factories, valid_<resource>_id lookups, rate-limit dependencies
    config.py          the domain's own settings
    constants.py       fixed limits
alembic/versions/      static, reversible migrations (YYYY-MM-DD_<slug>.py from now on)
scripts/               make_admin, maintenance (run from backend/: python -m scripts.<name>)
tests/                 pytest against a real Postgres test DB; tests/support/ mirrors the domains
```

Cross-domain imports name the module explicitly (`from app.review.models import Review`). Time comes from the injected `Clock` (`app/shared/clock.py`), so tests move it with `dependency_overrides` instead of patching. To add an SMS gateway, write one `SMSProvider` subclass and add it to `get_sms_provider()`.

## Operations

- **Image:** `docker build -t art-circle-api .`, run with `ENVIRONMENT=production` and real secrets. It runs as a non-root user, trusts `X-Forwarded-For` only from `FORWARDED_ALLOW_IPS`, and sizes workers with `WEB_CONCURRENCY`. `docker compose up --build` starts Postgres, migrations and the API locally.
- **Release:** run `alembic upgrade head` from the same image as a separate step before rolling out the API.
- **Probes:** liveness `GET /health/live`, readiness `GET /health/ready`.
- **Housekeeping:** schedule `python -m scripts.maintenance` every few minutes. It prunes used sign-in codes, dead refresh tokens and closed rate-limit windows.
- **Metrics:** `GET /metrics` (Prometheus, bearer `METRICS_TOKEN`): `http_requests_total` and `http_request_duration_seconds` per route template. The image aggregates across workers through `PROMETHEUS_MULTIPROC_DIR`.
- **Rollback:** every migration has a reversible `downgrade()`. Roll back by redeploying the previous image, running `alembic downgrade <previous revision>` first only if that release added a migration the old code can't run with.
- **Backups:** use the managed Postgres point-in-time recovery and test a restore before launch. Back up `AADHAAR_ENCRYPTION_KEY` separately from the database: stored Aadhaar numbers can't be decrypted without it.
- **Logs:** JSON lines on stdout. The `art_circle.access` logger writes one line per request, `art_circle.audit` covers security events (sign-ins, rejected codes, refresh-token reuse, every admin change), and every line carries the `request_id`.
- **Rate limits:** stored in Postgres, so every worker shares them. The auth endpoints are limited per IP and per phone; booking requests, reviews and upload signatures per user (`app/*/constants.py`).

## Migrations

```bash
alembic revision --autogenerate -m "describe change"   # review the generated file before committing
alembic upgrade head
alembic downgrade -1
```

## Tests and lint

```bash
pytest                      # migrates art_circle_test to head, then truncates tables after each test
pytest --cov=app            # with the 90% branch-coverage gate CI enforces (.coveragerc)
ruff check . && ruff format --check .
mypy                        # static types (mypy.ini)
pip-audit -r requirements.lock   # known vulnerabilities in pinned dependencies
alembic check               # models and migrations agree
```

The suite forces `ENVIRONMENT=test`, console SMS, fake storage and mock payments, and points even the app's own engine at the test database. It never sends real SMS; OTPs are read from `ConsoleSMSProvider.sent`. Swap dependencies with the `override` fixture and move time with `travel`. CI (`.github/workflows/backend.yml`) runs lint, mypy and pip-audit, then migrations from an empty database (up, check, down to base, up), the tests with coverage and the maintenance script, then builds the image, boots it against Postgres until `/health/ready` answers, and checks it refuses an unsafe production config.

After changing `requirements.txt`, regenerate the lock in a clean venv: `python -m venv /tmp/lock && /tmp/lock/bin/pip install -r requirements.txt && /tmp/lock/bin/pip freeze --exclude pip > requirements.lock` (keep the header comment).
