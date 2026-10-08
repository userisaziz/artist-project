# Artist Marketplace Backend — Increment 1 Design

**Date:** 2026-10-09
**Status:** Approved
**Scope:** FastAPI backend skeleton + AUTH domain + artist browse/profile APIs, built alongside the first three database stages (users → customer_profiles → artist_profiles).

---

## 1. Goals & non-goals

**Goals (this increment)**

- Running FastAPI backend on local Homebrew PostgreSQL with Alembic migrations.
- Phone + OTP authentication (dev-mode SMS provider), JWT access + refresh tokens.
- `users`, `customer_profiles`, `artist_profiles`, `otp_codes`, `refresh_tokens` tables + SQLAlchemy models.
- Artist browse/detail/"me" endpoints demonstrating the thin-route layered pattern.
- Repeatable pytest suite hitting a real test database.

**Non-goals (later milestones, in planned order)**

- Services/catalog (stage 4–5), availability (6), bookings (7), payments (8), reviews (9), messages (10), notifications (11), admin (12).
- Real SMS gateway (Twilio) — interface is built now, provider added later.
- `repositories/` layer — introduced when booking/payment query complexity arrives (~stage 7); services take `AsyncSession` directly until then.
- Email/password auth — the identity model is phone-only for this product.

## 2. Key decisions (with rationale)

| Decision | Choice | Why |
|---|---|---|
| ORM stack | SQLAlchemy 2.0 **async** + `asyncpg` | FastAPI is natively async; fits api→service layering; scales under I/O load. Alembic uses the standard async `env.py` pattern. |
| Database | Local Homebrew PostgreSQL 16 (16.14, `postgres@127.0.0.1:5432`) | User preference; `art_circle` (exists) + `art_circle_test` databases. |
| Auth day one | Phone + OTP, **dev-mode console provider** | OTP is the product's real flow, but no SMS account is needed to build/test it now. `SMSProvider` interface keeps Twilio a drop-in later. |
| Registration | Just-in-time on first OTP verify | Phone-OTP worlds have no separate register step; role is set when a customer/artist profile is completed, not at signup. |
| OTP/refresh storage | PostgreSQL tables, values **hashed** | Survives restarts, works with multiple workers, allows revocation. Plaintext OTPs/tokens are never stored. |
| Layering | `api/v1` (thin routes) → `services` (business logic, own the session) → models | Keeps routes free of logic; services testable by injecting a session. |
| tests location | `backend/tests/` (not `app/tests/`) | Cleaner pytest rootdir and imports. |
| models vs schemas | SQLAlchemy models = DB structure; Pydantic schemas = API contracts; never mix | Explicit request/response contracts decoupled from storage. |

## 3. Project layout

```text
backend/
├── app/
│   ├── main.py                 # create_app() factory, CORS, global exception handler, routers
│   ├── core/
│   │   ├── config.py           # pydantic-settings Settings (fail fast on missing env)
│   │   ├── database.py         # async engine, async_sessionmaker, get_db (commit/rollback)
│   │   ├── security.py         # OTP hashing, JWT create/verify helpers
│   │   └── dependencies.py     # get_current_user, pagination params
│   ├── models/
│   │   ├── base.py             # DeclarativeBase, timestamp mixin
│   │   ├── user.py
│   │   ├── customer_profile.py
│   │   ├── artist_profile.py
│   │   ├── otp_code.py
│   │   └── refresh_token.py
│   ├── schemas/
│   │   ├── auth.py             # OTPRequest, OTPVerify, TokenPair, RefreshRequest
│   │   ├── user.py             # UserOut
│   │   ├── artist.py           # ArtistSummary, ArtistDetail, ArtistUpdate
│   │   └── common.py           # Page[T], ErrorResponse
│   ├── api/
│   │   └── v1/
│   │       ├── router.py       # aggregates all v1 routers
│   │       ├── auth.py
│   │       └── artists.py
│   ├── services/
│   │   ├── auth_service.py
│   │   └── artist_service.py
│   └── utils/
│       ├── sms_provider.py     # SMSProvider ABC + ConsoleSMSProvider (+ TwilioSMSProvider later)
│       └── enums.py            # UserRole, etc.
├── alembic/                    # async env.py + versions/
├── tests/
│   ├── conftest.py             # test engine, alembic upgrade, truncate fixtures, AsyncClient
│   ├── test_auth.py
│   └── test_artists.py
├── .env                        # gitignored
├── .env.example
├── requirements.txt
├── alembic.ini
├── Dockerfile
└── README.md
```

## 4. Core wiring

- **`config.py`** — single `Settings` (pydantic-settings): `DATABASE_URL`, `TEST_DATABASE_URL`, `JWT_SECRET`, `JWT_ALGORITHM=HS256`, `ACCESS_TOKEN_TTL=15min`, `REFRESH_TOKEN_TTL=7d`, `DEBUG`, `SMS_PROVIDER=console|twilio`. Missing required var → startup error, not first-request error.
- **`database.py`** — module-level `create_async_engine` (shared pool) + `async_sessionmaker`. `get_db()` dependency yields a session and **commits on success, rolls back on exception**. Services never create their own sessions.
- **`main.py`** — `create_app()` factory; CORS for the React Native dev client; global exception handler mapping domain errors (`NotFoundError`, `AuthError`, `ConflictError`) to JSON `{"code", "message"}` with correct status codes; includes `api/v1/router.py` under `/api/v1`.

## 5. Data model (Alembic migration #1)

```text
users
├─ id uuid pk (gen_random_uuid())
├─ phone varchar unique, E.164 format — the login identity
├─ is_phone_verified bool default false
├─ is_active bool default true
├─ role user_role default 'customer'  (Postgres ENUM: customer|artist|admin)
├─ first_name / last_name nullable (collected during profile setup)
├─ email nullable, avatar_url nullable
├─ created_at / updated_at

customer_profiles                 (1-1 with users; presence implies customer role)
├─ user_id pk/fk → users.id
├─ bio, city, timezone
├─ profile_completed bool

artist_profiles                   (1-1 with users; presence implies artist role)
├─ user_id pk/fk → users.id
├─ display_name, bio, city
├─ categories text[]              (e.g. ["makeup", "photography"])
├─ experience_years int
├─ is_approved bool default false (admin gate, wired at stage 12)
├─ avg_rating numeric default 0, total_reviews int default 0
│                                 (denormalized; updated by review stage)
├─ profile_completed bool

otp_codes
├─ id uuid pk
├─ phone varchar, code_hash varchar
├─ expires_at (now + 5 min), attempts int default 0 (max 5)
├─ consumed_at nullable

refresh_tokens
├─ id uuid pk
├─ user_id fk, token_hash varchar unique
├─ expires_at, revoked_at nullable
```

Enums: `UserRole {customer, artist, admin}` as a Postgres ENUM created in migration #1. The column is set explicitly when a profile is created (completing an artist profile sets `role=artist`); profile-table presence and the role column are kept in sync by the service layer, and the column exists for cheap authorization checks and admin-stage filtering.

## 6. Auth flow

```text
POST /api/v1/auth/otp/request   {phone}
  1. rate-limit: reject if a code was sent to this phone < 60s ago (429)
  2. generate 6-digit code; store sha256 hash, 5-min expiry; invalidate prior codes
  3. SMSProvider.send(phone, code)
       DEBUG/console → logged to server console
       twilio (later) → real SMS, same interface
  → 204 always (no user-enumeration signal in response)

POST /api/v1/auth/otp/verify    {phone, code}
  1. fetch latest unconsumed, unexpired code for phone; check hash; attempts++ (max 5)
  2. mark consumed; get-or-create user (JIT registration, is_phone_verified=true)
  3. issue access JWT (15 min) + refresh JWT (7 d, sha256-hashed row in refresh_tokens)
  → {access_token, refresh_token, token_type, user}

POST /api/v1/auth/refresh       {refresh_token}
  1. look up hash, reject if revoked/expired (401)
  2. revoke old row, issue new pair (rotation)
  → {access_token, refresh_token}
```

`get_current_user` dependency: decode Bearer access JWT → load active `User` → inject into route.

## 7. Artists API

```text
GET  /api/v1/artists?city=&category=&page=1&page_size=20   public, paginated summaries
GET  /api/v1/artists/{id}                                   public detail (404 if absent/unapproved later)
GET  /api/v1/artists/me                                     authed artist
PATCH /api/v1/artists/me                                    authed artist updates profile fields
```

Route bodies stay ~5 lines: parse input schema → call `ArtistService(session)` → return output schema. `PATCH /api/v1/artists/me` is an **upsert**: if the caller has no `artist_profiles` row, one is created and the user's `role` is set to `artist` (this doubles as artist onboarding entry-point until the fuller flow arrives at stage 3).

## 8. Error handling

- Domain exceptions defined once (`app/core/` level): `NotFoundError(404)`, `AuthError(401)`, `RateLimitError(429)`, `ConflictError(409)`.
- Services raise them; a single FastAPI exception handler in `main.py` renders `{"code": "<machine_code>", "message": "<human>"}`.
- Pydantic validation errors keep FastAPI's default 422 shape, standardized in `schemas/common.py` docs.

## 9. Testing

- `pytest` + `pytest-asyncio` + `httpx.AsyncClient(transport=ASGITransport(app))`.
- Real Postgres test DB `art_circle_test` (SQLite would diverge on UUID/`text[]` behavior).
- `conftest.py`: run `alembic upgrade head` on test DB once per session; truncate tables between tests; override `get_db`.
- Console OTP provider writes the code into a test-visible capture (or the test calls `auth_service` to read the stored hash target) — no HTTP mocking needed.
- Coverage this increment: `test_auth.py` (request → verify → refresh → reuse-revoked fails; rate limit; wrong code; expiry) and `test_artists.py` (browse filters, pagination, me/get, auth required).

## 10. Local environment

```bash
brew services start postgresql@16   # already running on this machine
createdb art_circle_test            # art_circle already exists; postgres role needs no password locally
cp .env.example .env                # fill DATABASE_URL etc.
alembic upgrade head
uvicorn app.main:app --reload
```

Connection URL spelling for SQLAlchemy: `postgresql+asyncpg://postgres@127.0.0.1:5432/art_circle` — the `+asyncpg` suffix is the driver; the plain `postgresql://` form points at the same server.

`requirements.txt` (pinned): `fastapi`, `uvicorn[standard]`, `sqlalchemy[asyncio]~=2.0`, `asyncpg`, `alembic`, `pydantic~=2`, `pydantic-settings`, `pyjwt`, `python-dotenv`, `httpx`, `pytest`, `pytest-asyncio`, `ruff`.

## 11. Growth path (from the agreed sequence)

```text
1 users ✔  2 customer_profiles ✔  3 artist_profiles ✔
4 artist_services → 5 inclusions/addons → 6 availability → 7 bookings (+ repositories/ layer)
8 payments → 9 reviews → 10 messages → 11 notifications → 12 admin
```

Each stage adds: Postgres table + SQLAlchemy model + FastAPI API, delivered as its own spec → plan → build cycle.
