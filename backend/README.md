# Art Circle API

FastAPI backend for Art Circle: phone + OTP auth, JWT access/refresh tokens, and account onboarding. It runs on async SQLAlchemy over PostgreSQL, with Alembic migrations.

## Setup

Prerequisites: Python 3.12+ and a local PostgreSQL server (for example `brew install postgresql@16 && brew services start postgresql@16`).

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
createdb art_circle
createdb art_circle_test      # used by pytest
alembic upgrade head
uvicorn app.main:app --reload # add --host 0.0.0.0 to reach it from a phone on your LAN
```

Check that it's running: `curl localhost:8000/health` should return `{"status":"ok","db":"ok"}`. Interactive API docs are at http://localhost:8000/docs.

## Configuration (`.env`)

All settings live in `app/core/config.py` (pydantic-settings). If a required value is missing, the app fails at startup.

| Variable | Default | Notes |
|---|---|---|
| `DATABASE_URL` | required | `postgresql+asyncpg://...` |
| `TEST_DATABASE_URL` | required | Separate database. Tests truncate its tables. |
| `JWT_SECRET` | required | Use at least 32 random bytes outside dev |
| `JWT_ALGORITHM` | `HS256` | |
| `ACCESS_TOKEN_TTL_MINUTES` | `15` | |
| `REFRESH_TOKEN_TTL_DAYS` | `7` | |
| `OTP_TTL_MINUTES` | `5` | |
| `OTP_MAX_ATTEMPTS` | `5` | Wrong guesses allowed before the code is burned |
| `OTP_RESEND_COOLDOWN_SECONDS` | `60` | Faster re-requests get a `429 rate_limited` response |
| `DEBUG` | `true` | Allows CORS from every origin when true |
| `SMS_PROVIDER` | `console` | `console` logs OTPs to the server output; `fast2sms` sends real SMS |
| `FAST2SMS_API_KEY` | empty | Required when `SMS_PROVIDER=fast2sms` |
| `AADHAAR_ENCRYPTION_KEY` | required | Fernet key that encrypts stored Aadhaar numbers; the app won't start without it. Generate one with `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`. Losing it makes stored Aadhaar numbers unrecoverable, so back it up. |

> `.env.example` ships with `SMS_PROVIDER=fast2sms`. For local development, set it to `console` and read codes from the uvicorn log (`[console-sms] to=+91... | Your Art Circle code is 123456`).

## API

Every route is under `/api/v1` except `/health`.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/health` | none | App and DB liveness |
| POST | `/auth/otp/request` | none | `{phone}` (E.164). Always returns `204`, so the response doesn't reveal whether the phone is registered. |
| POST | `/auth/otp/verify` | none | `{phone, code}` → `{access_token, refresh_token, token_type, user}`. Creates the user on first sign-in. |
| POST | `/auth/refresh` | none | `{refresh_token}` → new token pair (rotated) |
| GET | `/users/me` | Bearer | Current user |
| PATCH | `/users/me` | Bearer | Sign-up details: `{first_name, last_name?, email?, whatsapp_booking_updates?}` |
| PUT | `/users/me/role` | Bearer | `{role: "customer" \| "artist"}`. Can be called once; sets `is_onboarded=true`. |
| PUT | `/artists/me/kyc` | Bearer (artist) | Aadhaar verification: `{aadhaar_number, front_key, back_key}`. The number is validated and stored encrypted; the keys come from `/uploads/signature` with `purpose: "aadhaar"`. |
| POST | `/uploads/signature` | Bearer | With `purpose: "aadhaar"`, signs an upload of an Aadhaar image to private storage. |
| POST | `/admin/artists/{id}/kyc/reveal` | Bearer (admin) | Returns `{aadhaar_number}` in full. Admin-only. Each call is logged in `aadhaar_reveals`, and the response is `Cache-Control: no-store`. |

### Error contract

Domain errors return `{"code": "...", "message": "..."}`. Clients branch on `code` and never on `message`, so treat the codes as part of the API contract (`app/core/exceptions.py`):

| Status | `code` | Example |
|---|---|---|
| 401 | `auth_error` | Invalid or expired OTP, bad refresh token |
| 404 | `not_found` | |
| 409 | `conflict` | Email already in use, role already chosen |
| 429 | `rate_limited` | OTP re-requested inside the cooldown window |

Request validation failures use FastAPI's default `422` shape.

## Project structure

```
app/
  main.py            app factory: CORS, routers, AppError handler, /health
  api/v1/            thin route handlers (auth.py, users.py)
  core/              config, database engine/session, dependencies, security (JWT, hashing), exceptions
  models/            SQLAlchemy models: User, OTPCode, RefreshToken
  schemas/           Pydantic request/response models
  services/          business rules (AuthService, UserService)
  utils/             enums, SMSProvider seam (console / Fast2SMS)
alembic/versions/    migrations
tests/               pytest suite against a real Postgres test DB
```

Routes stay thin: they parse input, call a service, and shape the output. Services take an `AsyncSession` directly; there is no repository layer yet. To add an SMS gateway, write one `SMSProvider` subclass and add a branch in `get_sms_provider()`.

## Migrations

```bash
alembic revision --autogenerate -m "describe change"   # review the generated file before committing
alembic upgrade head
alembic downgrade -1
```

## Tests and lint

```bash
pytest          # migrates art_circle_test to head, then truncates tables after each test
ruff check .
```

Tests always force `SMS_PROVIDER=console`, so they never send real SMS. They read OTPs from `ConsoleSMSProvider.sent`.
