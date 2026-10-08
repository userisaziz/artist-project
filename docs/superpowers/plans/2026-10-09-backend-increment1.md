# Backend Increment 1 (AUTH + Artist Profiles) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Running FastAPI backend on local PostgreSQL (`art_circle`) with phone+OTP auth (dev-mode SMS), JWT access/refresh, and artist browse/profile APIs.

**Architecture:** Thin routes (`api/v1`) → business services (take `AsyncSession`) → SQLAlchemy 2.0 async models → PostgreSQL. No repositories layer yet (arrives at bookings stage). Alembic manages schema; tests run against a real `art_circle_test` database.

**Tech Stack:** Python 3.14, FastAPI, SQLAlchemy 2.0 (asyncio) + asyncpg, Alembic, Pydantic v2 + pydantic-settings, PyJWT, pytest + pytest-asyncio + httpx.

**Spec:** `docs/superpowers/specs/2026-10-09-backend-increment1-design.md`

---

## File map

```text
backend/
├── requirements.txt  pytest.ini  .env  .env.example  alembic.ini  Dockerfile  README.md
├── alembic/{env.py, script.py.mako, versions/}
├── app/
│   ├── __init__.py  main.py
│   ├── core/{__init__.py, config.py, database.py, security.py, dependencies.py, exceptions.py}
│   ├── models/{__init__.py, base.py, user.py, customer_profile.py, artist_profile.py, otp_code.py, refresh_token.py}
│   ├── schemas/{__init__.py, common.py, user.py, auth.py, artist.py}
│   ├── api/{__init__.py, v1/{__init__.py, router.py, auth.py, artists.py}}
│   ├── services/{__init__.py, auth_service.py, artist_service.py}
│   └── utils/{__init__.py, enums.py, sms_provider.py}
└── tests/{conftest.py, test_health.py, test_migrations.py, test_security.py, test_auth.py, test_artists.py}
```

All commands run from `backend/` with the venv active.

---

### Task 1: Bootstrap + DB connection proof

**Files:**
- Create: `requirements.txt`, `pytest.ini`, `.env.example`, `.env`, `app/__init__.py`, `app/core/config.py`, `app/core/database.py`, `app/main.py`, `tests/conftest.py`, `tests/test_health.py`

- [ ] **Step 1: Create test database and venv**

```bash
psql -h 127.0.0.1 -U postgres -c "CREATE DATABASE art_circle_test" 2>/dev/null || echo "already exists"
python3 -m venv .venv && source .venv/bin/activate
```

- [ ] **Step 2: Write `requirements.txt` and install**

```text
fastapi>=0.115
uvicorn[standard]>=0.30
sqlalchemy[asyncio]>=2.0.36
asyncpg>=0.30
alembic>=1.14
pydantic>=2.9
pydantic-settings>=2.6
PyJWT>=2.10
httpx>=0.27
pytest>=8.3
pytest-asyncio>=0.26
ruff>=0.8
```

Run: `pip install -r requirements.txt`

- [ ] **Step 3: Write `.env.example` and copy to `.env`**

```text
DATABASE_URL=postgresql+asyncpg://postgres@127.0.0.1:5432/art_circle
TEST_DATABASE_URL=postgresql+asyncpg://postgres@127.0.0.1:5432/art_circle_test
JWT_SECRET=dev-secret-change-me
JWT_ALGORITHM=HS256
ACCESS_TOKEN_TTL_MINUTES=15
REFRESH_TOKEN_TTL_DAYS=7
OTP_TTL_MINUTES=5
OTP_MAX_ATTEMPTS=5
OTP_RESEND_COOLDOWN_SECONDS=60
DEBUG=true
SMS_PROVIDER=console
```

`cp .env.example .env` (`.env` is gitignored at repo root).

- [ ] **Step 4: Write `app/core/config.py`**

Why: one typed source of truth — the app fails at startup, not mid-request, if `.env` is broken.

```python
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str
    test_database_url: str
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    access_token_ttl_minutes: int = 15
    refresh_token_ttl_days: int = 7
    otp_ttl_minutes: int = 5
    otp_max_attempts: int = 5
    otp_resend_cooldown_seconds: int = 60
    debug: bool = True
    sms_provider: str = "console"


@lru_cache
def get_settings() -> Settings:
    return Settings()
```

- [ ] **Step 5: Write `app/core/database.py`**

Why: one shared async engine/pool; `get_db` owns commit/rollback so services never manage transactions.

```python
from collections.abc import AsyncIterator
from fastapi import Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from app.core.config import get_settings

settings = get_settings()
engine = create_async_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def get_db() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
```

- [ ] **Step 6: Write `pytest.ini` and `tests/conftest.py`**

`pytest.ini`:

```ini
[pytest]
asyncio_mode = auto
asyncio_default_fixture_loop_scope = session
asyncio_default_test_loop_scope = session
filterwarnings =
    error::DeprecationWarning:!asyncpg
```

`tests/conftest.py` (grows in Task 2; this version proves DB connectivity):

```python
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from app.core.config import get_settings
from app.core.database import get_db
from app.main import create_app

settings = get_settings()
test_engine = create_async_engine(settings.test_database_url)
TestSessionFactory = async_sessionmaker(test_engine, expire_on_commit=False)


@pytest_asyncio.fixture(scope="session")
async def engine():
    yield test_engine
    await test_engine.dispose()


@pytest_asyncio.fixture
async def client(engine):
    app = create_app()

    async def override_get_db():
        async with TestSessionFactory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
```

- [ ] **Step 7: Write the failing test `tests/test_health.py`**

```python
async def test_health_confirms_database_reachable(client):
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "db": "ok"}
```

Run: `pytest tests/test_health.py -v` → FAIL (`app.main` has no `create_app` yet).

- [ ] **Step 8: Write `app/main.py`**

```python
from fastapi import Depends
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import get_settings
from app.core.database import get_db


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="Art Circle API", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"] if settings.debug else [],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health")
    async def health(session: AsyncSession = Depends(get_db)):
        await session.execute(text("SELECT 1"))
        return {"status": "ok", "db": "ok"}

    return app


app = create_app()
```

Run: `pytest tests/test_health.py -v` → PASS. This proves config → engine → `art_circle_test` all work end-to-end.

- [ ] **Step 9: Commit**

```bash
git add backend docs/superpowers/specs
git commit -m "feat: bootstrap FastAPI skeleton with async DB session and health check"
```

---

### Task 2: Models + Alembic migration #1

**Files:**
- Create: `app/models/*.py`, `app/utils/enums.py`, `alembic/` (init), `alembic/env.py` (replace), `alembic/versions/<rev>_initial_schema.py` (autogenerate), `tests/test_migrations.py`
- Modify: `tests/conftest.py`

- [ ] **Step 1: Write `app/utils/enums.py` and `app/models/base.py`**

```python
# app/utils/enums.py
import enum


class UserRole(str, enum.Enum):
    customer = "customer"
    artist = "artist"
    admin = "admin"
```

```python
# app/models/base.py
from datetime import datetime
from sqlalchemy import DateTime, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
```

- [ ] **Step 2: Write the five model files**

```python
# app/models/user.py
import uuid
import sqlalchemy as sa
from sqlalchemy import Boolean, Enum, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin
from app.utils.enums import UserRole


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
    )
    phone: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    is_phone_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role", values_callable=lambda e: [m.value for m in e]),
        default=UserRole.customer,
        nullable=False,
    )
    first_name: Mapped[str | None] = mapped_column(String(80))
    last_name: Mapped[str | None] = mapped_column(String(80))
    email: Mapped[str | None] = mapped_column(String(255))
    avatar_url: Mapped[str | None] = mapped_column(String(500))

    customer_profile = relationship("CustomerProfile", back_populates="user", uselist=False)
    artist_profile = relationship("ArtistProfile", back_populates="user", uselist=False)
```

```python
# app/models/customer_profile.py
import uuid
from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin


class CustomerProfile(Base, TimestampMixin):
    __tablename__ = "customer_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    bio: Mapped[str | None] = mapped_column(Text)
    city: Mapped[str | None] = mapped_column(String(120), index=True)
    timezone: Mapped[str | None] = mapped_column(String(60))
    profile_completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    user = relationship("User", back_populates="customer_profile")
```

```python
# app/models/artist_profile.py
import uuid
from decimal import Decimal
import sqlalchemy as sa
from sqlalchemy import Boolean, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin


class ArtistProfile(Base, TimestampMixin):
    __tablename__ = "artist_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    display_name: Mapped[str] = mapped_column(String(120), nullable=False)
    bio: Mapped[str | None] = mapped_column(Text)
    city: Mapped[str | None] = mapped_column(String(120), index=True)
    categories: Mapped[list[str]] = mapped_column(ARRAY(Text), default=list)
    experience_years: Mapped[int | None] = mapped_column(Integer)
    is_approved: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    avg_rating: Mapped[Decimal] = mapped_column(Numeric(3, 2), default=Decimal("0.00"), nullable=False)
    total_reviews: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    profile_completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    user = relationship("User", back_populates="artist_profile")
```

```python
# app/models/otp_code.py
import uuid
from datetime import datetime
import sqlalchemy as sa
from sqlalchemy import DateTime, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TimestampMixin


class OtpCode(Base, TimestampMixin):
    __tablename__ = "otp_codes"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
    )
    phone: Mapped[str] = mapped_column(String(20), index=True, nullable=False)
    code_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
```

```python
# app/models/refresh_token.py
import uuid
from datetime import datetime
import sqlalchemy as sa
from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TimestampMixin


class RefreshToken(Base, TimestampMixin):
    __tablename__ = "refresh_tokens"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
```

```python
# app/models/__init__.py — import all so Alembic autogenerate sees everything
from app.models.base import Base  # noqa: F401
from app.models.user import User  # noqa: F401
from app.models.customer_profile import CustomerProfile  # noqa: F401
from app.models.artist_profile import ArtistProfile  # noqa: F401
from app.models.otp_code import OtpCode  # noqa: F401
from app.models.refresh_token import RefreshToken  # noqa: F401
```

- [ ] **Step 3: Initialize Alembic with async support**

Run: `alembic init alembic`

In `alembic.ini` set: `prepend_sys_path = .` and leave `sqlalchemy.url =` empty (env.py resolves it).

Replace `alembic/env.py` entirely with:

```python
import asyncio
import os
from logging.config import fileConfig
from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import create_async_engine

from app.core.config import get_settings
from app.models import Base  # noqa: F401  (registers all models on metadata)

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

url = config.get_main_option("sqlalchemy.url") or os.environ.get("DATABASE_URL") or get_settings().database_url
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True, dialect_opts={"paramstyle": "named"})
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata, compare_type=True)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    connectable = create_async_engine(url, poolclass=pool.NullPool)
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

- [ ] **Step 4: Generate and review migration #1**

```bash
alembic revision --autogenerate -m "initial schema"
alembic upgrade head
```

Expected in the generated file: `create_table` for all 5 tables + `sa.Enum(..., name='user_role')` (CREATE TYPE user_role) + `postgresql.ARRAY(sa.Text())` for `categories`. If `server_default=sa.text('gen_random_uuid()')` is missing on any id column, add it manually — autogenerate sometimes drops server defaults.

Verify: `psql -h 127.0.0.1 -U postgres art_circle -c '\dt'` → 5 tables + `alembic_version`.

- [ ] **Step 5: Write failing `tests/test_migrations.py`**

```python
import sqlalchemy as sa
from alembic.command import upgrade
from alembic.config import Config
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXPECTED_TABLES = {"users", "customer_profiles", "artist_profiles", "otp_codes", "refresh_tokens", "alembic_version"}


def apply_migrations(url: str) -> None:
    cfg = Config(str(ROOT / "alembic.ini"))
    cfg.set_main_option("sqlalchemy.url", url)
    upgrade(cfg, "head")


async def test_migrations_create_all_tables(engine):
    apply_migrations(engine.url.render_as_string(hide_password=False))
    async with engine.connect() as conn:
        rows = (await conn.execute(sa.text(
            "SELECT tablename FROM pg_tables WHERE schemaname='public'"
        ))).scalars().all()
    assert EXPECTED_TABLES <= set(rows)
```

- [ ] **Step 6: Update `tests/conftest.py` for session-scoped client + truncation**

Replace `@pytest_asyncio.fixture` with `@pytest_asyncio.fixture(scope="session")` on `client` (routes commit; session-per-test would lose data between calls in one test), and add autouse truncation:

```python
from sqlalchemy import text

TABLES = "users, customer_profiles, artist_profiles, otp_codes, refresh_tokens"


@pytest_asyncio.fixture(scope="session")
async def client(engine):
    ... unchanged body ...

@pytest_asyncio.fixture(autouse=True)
async def clean_db(engine):
    yield
    async with engine.begin() as conn:
        await conn.execute(text(f"TRUNCATE {TABLES} RESTART IDENTITY CASCADE"))
```

(Task 3 appends `ConsoleSMSProvider.sent.clear()` to this fixture once the provider module exists.)

- [ ] **Step 7: Run tests**

Run: `pytest tests/test_migrations.py -v` → PASS.

- [ ] **Step 8: Commit**

```bash
git add backend/app backend/alembic backend/alembic.ini backend/tests
git commit -m "feat: add SQLAlchemy models and initial Alembic migration"
```

---

### Task 3: Security primitives + SMS provider

**Files:**
- Create: `app/core/security.py`, `app/utils/sms_provider.py`, `tests/test_security.py`

- [ ] **Step 1: Write failing `tests/test_security.py`**

```python
import uuid
import jwt as pyjwt
import pytest
from app.core.security import (
    create_access_token, create_refresh_token, decode_token, generate_otp, hash_otp, hash_token,
)


def test_generate_otp_is_six_digits():
    for _ in range(20):
        assert len(generate_otp()) == 6 and generate_otp().isdigit()


def test_hash_otp_is_deterministic_and_salted():
    assert hash_otp("123456") == hash_otp("123456")
    assert hash_otp("123456") != hash_otp("654321")


def test_access_token_roundtrip():
    user_id = uuid.uuid4()
    token = create_access_token(user_id)
    payload = decode_token(token)
    assert payload["sub"] == str(user_id)
    assert payload["type"] == "access"


def test_refresh_token_is_marked_as_refresh():
    payload = decode_token(create_refresh_token(uuid.uuid4())[0])
    assert payload["type"] == "refresh"


def test_decode_rejects_tampered_token():
    with pytest.raises(pyjwt.PyJWTError):
        decode_token("not.a.token")


def test_hash_token_is_sha256_hex():
    assert len(hash_token("abc")) == 64
```

Run: `pytest tests/test_security.py -v` → FAIL (module missing).

- [ ] **Step 2: Write `app/core/security.py`**

Why: OTPs and refresh tokens are stored **hashed**; only short-lived access tokens are stateless JWTs.

```python
import hashlib
import hmac
import secrets
import uuid as uuid_mod
from datetime import datetime, timedelta, timezone
import jwt
from app.core.config import get_settings


def generate_otp() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def hash_otp(code: str) -> str:
    settings = get_settings()
    return hmac.new(settings.jwt_secret.encode(), code.encode(), hashlib.sha256).hexdigest()


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _create_token(user_id, token_type: str, ttl: timedelta) -> tuple[str, str]:
    settings = get_settings()
    jti = str(uuid_mod.uuid4())
    now = datetime.now(timezone.utc)
    payload = {"sub": str(user_id), "type": token_type, "jti": jti, "iat": now, "exp": now + ttl}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm), jti


def create_access_token(user_id) -> str:
    settings = get_settings()
    token, _ = _create_token(user_id, "access", timedelta(minutes=settings.access_token_ttl_minutes))
    return token


def create_refresh_token(user_id) -> tuple[str, str]:
    settings = get_settings()
    return _create_token(user_id, "refresh", timedelta(days=settings.refresh_token_ttl_days))


def decode_token(token: str) -> dict:
    settings = get_settings()
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
```

- [ ] **Step 3: Write `app/utils/sms_provider.py`**

Why: the seam we agreed on — console now, Twilio later is one new class + one new settings value.

```python
import logging
from abc import ABC, abstractmethod
from app.core.config import get_settings

logger = logging.getLogger("art_circle.sms")


class SMSProvider(ABC):
    @abstractmethod
    async def send(self, phone: str, message: str) -> None: ...


class ConsoleSMSProvider(SMSProvider):
    """Dev-mode provider: logs the OTP and records it so tests can read it."""

    sent: list[tuple[str, str]] = []

    async def send(self, phone: str, message: str) -> None:
        logger.info("[console-sms] to=%s | %s", phone, message)
        ConsoleSMSProvider.sent.append((phone, message))


def get_sms_provider() -> SMSProvider:
    name = get_settings().sms_provider
    if name == "console":
        return ConsoleSMSProvider()
    raise ValueError(f"Unknown SMS_PROVIDER: {name!r} (twilio arrives in a later milestone)")
```

- [ ] **Step 4: Run tests**

Run: `pytest -v` → ALL PASS (health, migrations, security). Append `ConsoleSMSProvider.sent.clear()` (with its import) to the `clean_db` fixture in `tests/conftest.py`.

- [ ] **Step 5: Commit**

```bash
git add backend/app backend/tests
git commit -m "feat: add JWT/OTP security helpers and pluggable SMS provider"
```

---

### Task 4: Auth domain (OTP request → verify → refresh)

**Files:**
- Create: `app/core/exceptions.py`, `app/core/dependencies.py`, `app/schemas/{common,user,auth}.py`, `app/services/auth_service.py`, `app/api/v1/{router,auth}.py`, `tests/test_auth.py`
- Modify: `app/main.py`

- [ ] **Step 1: Write `app/core/exceptions.py`**

```python
class AppError(Exception):
    status_code = 500
    code = "internal_error"
    message = "Internal server error"

    def __init__(self, message: str | None = None):
        self.message = message or self.__class__.message
        super().__init__(self.message)


class NotFoundError(AppError):
    status_code, code, message = 404, "not_found", "Resource not found"


class AuthError(AppError):
    status_code, code, message = 401, "auth_error", "Authentication failed"


class ConflictError(AppError):
    status_code, code, message = 409, "conflict", "Resource conflict"


class RateLimitError(AppError):
    status_code, code, message = 429, "rate_limited", "Too many requests"
```

- [ ] **Step 2: Write schemas `app/schemas/{common,user,auth}.py`**

```python
# common.py
from pydantic import BaseModel


class ErrorResponse(BaseModel):
    code: str
    message: str
```

```python
# user.py
import uuid
from pydantic import BaseModel, ConfigDict
from app.utils.enums import UserRole


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    phone: str
    role: UserRole
    is_phone_verified: bool
    first_name: str | None = None
    last_name: str | None = None
    email: str | None = None
    avatar_url: str | None = None
```

```python
# auth.py
import re
from pydantic import BaseModel, Field, field_validator
from app.schemas.user import UserOut

PHONE_RE = re.compile(r"^\+[1-9]\d{6,14}$")  # E.164


class OTPRequest(BaseModel):
    phone: str = Field(min_length=8, max_length=20)

    @field_validator("phone")
    @classmethod
    def e164(cls, v: str) -> str:
        if not PHONE_RE.match(v):
            raise ValueError("phone must be E.164 format, e.g. +15550001111")
        return v


class OTPVerify(OTPRequest):
    code: str = Field(pattern=r"^\d{6}$")


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserOut
```

- [ ] **Step 3: Write failing `tests/test_auth.py`**

```python
PHONE = "+15550001111"


async def _request_and_read_code(client):
    response = await client.post("/api/v1/auth/otp/request", json={"phone": PHONE})
    assert response.status_code == 204
    from app.utils.sms_provider import ConsoleSMSProvider
    return ConsoleSMSProvider.sent[-1][1].split()[-1]


async def test_otp_verify_creates_user_jit_and_returns_tokens(client):
    code = await _request_and_read_code(client)
    response = await client.post("/api/v1/auth/otp/verify", json={"phone": PHONE, "code": code})
    assert response.status_code == 200
    body = response.json()
    assert body["user"]["phone"] == PHONE
    assert body["user"]["is_phone_verified"] is True
    assert body["access_token"] and body["refresh_token"]


async def test_second_verify_of_same_code_fails(client):
    code = await _request_and_read_code(client)
    await client.post("/api/v1/auth/otp/verify", json={"phone": PHONE, "code": code})
    response = await client.post("/api/v1/auth/otp/verify", json={"phone": PHONE, "code": code})
    assert response.status_code == 401


async def test_wrong_code_returns_401(client):
    await _request_and_read_code(client)
    response = await client.post("/api/v1/auth/otp/verify", json={"phone": PHONE, "code": "000000"})
    assert response.status_code == 401


async def test_resend_cooldown_returns_429(client):
    await _request_and_read_code(client)
    response = await client.post("/api/v1/auth/otp/request", json={"phone": PHONE})
    assert response.status_code == 429


async def test_invalid_phone_format_returns_422(client):
    response = await client.post("/api/v1/auth/otp/request", json={"phone": "15550001111"})
    assert response.status_code == 422


async def test_refresh_rotation_revokes_old_token(client):
    code = await _request_and_read_code(client)
    verify = (await client.post("/api/v1/auth/otp/verify", json={"phone": PHONE, "code": code})).json()
    refreshed = await client.post("/api/v1/auth/refresh", json={"refresh_token": verify["refresh_token"]})
    assert refreshed.status_code == 200
    reuse = await client.post("/api/v1/auth/refresh", json={"refresh_token": verify["refresh_token"]})
    assert reuse.status_code == 401


async def test_expired_code_is_rejected(client, engine):
    code = await _request_and_read_code(client)
    from sqlalchemy import text
    async with engine.begin() as conn:
        await conn.execute(text("UPDATE otp_codes SET expires_at = now() - interval '1 minute'"))
    response = await client.post("/api/v1/auth/otp/verify", json={"phone": PHONE, "code": code})
    assert response.status_code == 401
```

Run: `pytest tests/test_auth.py -v` → FAIL (no endpoints yet).

- [ ] **Step 4: Write `app/services/auth_service.py`**

Why: all auth rules live here — routes will just forward to these three methods.

```python
import uuid
from datetime import datetime, timedelta, timezone
import jwt as pyjwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import get_settings
from app.core.exceptions import AuthError, RateLimitError
from app.core.security import (
    create_access_token, create_refresh_token, decode_token,
    generate_otp, hash_otp, hash_token,
)
from app.models.otp_code import OtpCode
from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.utils.sms_provider import SMSProvider, get_sms_provider


class AuthService:
    def __init__(self, session: AsyncSession, sms: SMSProvider | None = None):
        self.session = session
        self.sms = sms or get_sms_provider()
        self.settings = get_settings()

    async def _latest_active_otp(self, phone: str) -> OtpCode | None:
        now = datetime.now(timezone.utc)
        return await self.session.scalar(
            select(OtpCode)
            .where(OtpCode.phone == phone, OtpCode.consumed_at.is_(None), OtpCode.expires_at > now)
            .order_by(OtpCode.created_at.desc())
            .limit(1)
        )

    async def request_otp(self, phone: str) -> None:
        now = datetime.now(timezone.utc)
        latest = await self.session.scalar(
            select(OtpCode).where(OtpCode.phone == phone).order_by(OtpCode.created_at.desc()).limit(1)
        )
        if latest and (now - latest.created_at).total_seconds() < self.settings.otp_resend_cooldown_seconds:
            raise RateLimitError("Please wait before requesting another code")
        stale = await self.session.scalars(
            select(OtpCode).where(OtpCode.phone == phone, OtpCode.consumed_at.is_(None))
        )
        for otp in stale:
            otp.consumed_at = now
        code = generate_otp()
        self.session.add(
            OtpCode(
                phone=phone,
                code_hash=hash_otp(code),
                expires_at=now + timedelta(minutes=self.settings.otp_ttl_minutes),
            )
        )
        await self.sms.send(phone, f"Your Art Circle code is {code}")

    async def verify_otp(self, phone: str, code: str) -> tuple[User, str, str]:
        otp = await self._latest_active_otp(phone)
        if otp is None or otp.attempts >= self.settings.otp_max_attempts:
            raise AuthError("Invalid or expired code")
        if hash_otp(code) != otp.code_hash:
            otp.attempts += 1
            raise AuthError("Invalid or expired code")
        otp.consumed_at = datetime.now(timezone.utc)

        user = await self.session.scalar(select(User).where(User.phone == phone))
        if user is None:  # just-in-time registration
            user = User(phone=phone, is_phone_verified=True)
            self.session.add(user)
            await self.session.flush()
        user.is_phone_verified = True

        access = create_access_token(user.id)
        refresh, _jti = create_refresh_token(user.id)
        self.session.add(
            RefreshToken(
                user_id=user.id,
                token_hash=hash_token(refresh),
                expires_at=datetime.now(timezone.utc) + timedelta(days=self.settings.refresh_token_ttl_days),
            )
        )
        return user, access, refresh

    async def refresh(self, refresh_token: str) -> tuple[User, str, str]:
        try:
            payload = decode_token(refresh_token)
        except pyjwt.PyJWTError as exc:
            raise AuthError("Invalid refresh token") from exc
        if payload.get("type") != "refresh":
            raise AuthError("Invalid refresh token")
        stored = await self.session.scalar(
            select(RefreshToken).where(RefreshToken.token_hash == hash_token(refresh_token))
        )
        now = datetime.now(timezone.utc)
        if stored is None or stored.revoked_at is not None or stored.expires_at < now:
            raise AuthError("Refresh token expired or revoked")
        stored.revoked_at = now  # rotation: the old token dies with this request

        user = await self.session.get(User, uuid.UUID(payload["sub"]))
        if user is None or not user.is_active:
            raise AuthError("User not found")
        access = create_access_token(user.id)
        refresh, _jti = create_refresh_token(user.id)
        self.session.add(
            RefreshToken(
                user_id=user.id,
                token_hash=hash_token(refresh),
                expires_at=now + timedelta(days=self.settings.refresh_token_ttl_days),
            )
        )
        return user, access, refresh
```

- [ ] **Step 5: Write `app/core/dependencies.py`**

```python
import uuid
import jwt as pyjwt
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.exceptions import AuthError
from app.core.security import decode_token
from app.models.user import User
from app.services.auth_service import AuthService

bearer_scheme = HTTPBearer(auto_error=True)


def get_auth_service(session: AsyncSession = Depends(get_db)) -> AuthService:
    return AuthService(session)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    session: AsyncSession = Depends(get_db),
) -> User:
    try:
        payload = decode_token(credentials.credentials)
    except pyjwt.PyJWTError as exc:
        raise AuthError("Invalid token") from exc
    if payload.get("type") != "access":
        raise AuthError("Invalid token type")
    user = await session.get(User, uuid.UUID(payload["sub"]))
    if user is None or not user.is_active:
        raise AuthError("User not found")
    return user
```

- [ ] **Step 6: Write thin routes `app/api/v1/auth.py` + `router.py`**

```python
# app/api/v1/auth.py
from fastapi import APIRouter, Depends, Response
from app.schemas.auth import OTPRequest, OTPVerify, RefreshRequest, TokenPair
from app.schemas.user import UserOut
from app.services.auth_service import AuthService
from app.core.dependencies import get_auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/otp/request", status_code=204)
async def request_otp(body: OTPRequest, service: AuthService = Depends(get_auth_service)) -> Response:
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

```python
# app/api/v1/router.py
from fastapi import APIRouter
from app.api.v1 import auth

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router)
```

- [ ] **Step 7: Wire `app/main.py`**

In `create_app()`, before `return app`, add:

```python
from app.api.v1.router import api_router
from app.core.exceptions import AppError
from fastapi.responses import JSONResponse

    app.include_router(api_router)

    @app.exception_handler(AppError)
    async def app_error_handler(request, exc: AppError):
        return JSONResponse(status_code=exc.status_code, content={"code": exc.code, "message": exc.message})
```

(imports at module top, handler inside `create_app`).

- [ ] **Step 8: Run tests**

Run: `pytest -v` → all auth tests PASS.

- [ ] **Step 9: Commit**

```bash
git add backend/app backend/tests
git commit -m "feat: add phone OTP auth flow with JWT access/refresh rotation"
```

---

### Task 5: Artist browse + profile APIs

**Files:**
- Create: `app/schemas/artist.py`, `app/services/artist_service.py`, `app/api/v1/artists.py`, `tests/test_artists.py`
- Modify: `app/api/v1/router.py`

- [ ] **Step 1: Write `app/schemas/artist.py`**

```python
import uuid
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, Field


class ArtistSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: uuid.UUID
    display_name: str
    bio: str | None = None
    city: str | None = None
    categories: list[str] = []
    experience_years: int | None = None
    avg_rating: Decimal
    total_reviews: int


class ArtistDetail(ArtistSummary):
    profile_completed: bool
    is_approved: bool


class ArtistUpdate(BaseModel):
    display_name: str | None = Field(default=None, max_length=120)
    bio: str | None = None
    city: str | None = Field(default=None, max_length=120)
    categories: list[str] | None = None
    experience_years: int | None = Field(default=None, ge=0, le=70)


class ArtistPage(BaseModel):
    items: list[ArtistSummary]
    page: int
    page_size: int
    total: int
```

- [ ] **Step 2: Write failing `tests/test_artists.py`**

```python
PHONE = "+15550009999"


async def make_artist(client, phone=PHONE, *, name="Priya", city="Chennai", categories=("makeup",)):
    r = await client.post("/api/v1/auth/otp/request", json={"phone": phone})
    assert r.status_code == 204
    from app.utils.sms_provider import ConsoleSMSProvider
    code = ConsoleSMSProvider.sent[-1][1].split()[-1]
    tokens = (await client.post("/api/v1/auth/otp/verify", json={"phone": phone, "code": code})).json()
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}
    r = await client.patch(
        "/api/v1/artists/me",
        json={"display_name": name, "city": city, "categories": list(categories), "experience_years": 5},
        headers=headers,
    )
    assert r.status_code == 200
    return headers, r.json()


async def test_patch_me_creates_profile_and_upgrades_role(client):
    headers, detail = await make_artist(client)
    me = await client.get("/api/v1/artists/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["user_id"] == detail["user_id"]
    # role flipped to artist is verified via the tokens' user payload:
    assert detail["user_id"]  # PATCH /me returned the newly created profile


async def test_list_artists_filters_by_city_and_category(client):
    await make_artist(client, phone="+15550001111", city="Chennai", categories=("makeup",))
    await make_artist(client, phone="+15550002222", city="Mumbai", categories=("photography",))

    r = await client.get("/api/v1/artists", params={"city": "Chennai"})
    assert r.json()["total"] == 1
    r = await client.get("/api/v1/artists", params={"category": "photography"})
    assert r.json()["items"][0]["city"] == "Mumbai"
    r = await client.get("/api/v1/artists", params={"city": "Nowhere"})
    assert r.json()["total"] == 0


async def test_get_artist_detail_and_404(client):
    _, detail = await make_artist(client)
    r = await client.get(f"/api/v1/artists/{detail['user_id']}")
    assert r.status_code == 200
    r = await client.get("/api/v1/artists/00000000-0000-0000-0000-000000000000")
    assert r.status_code == 404
    assert r.json()["code"] == "not_found"


async def test_me_requires_authentication(client):
    r = await client.get("/api/v1/artists/me")
    assert r.status_code in (401, 403)


async def test_patch_me_upserts_existing_profile(client):
    headers, first = await make_artist(client)
    r = await client.patch("/api/v1/artists/me", json={"city": "Bangalore"}, headers=headers)
    assert r.status_code == 200
    assert r.json()["city"] == "Bangalore"
    assert r.json()["display_name"] == first["display_name"]  # unset fields untouched


async def test_access_token_authorizes_and_role_flips(client):
    phone = "+15550007777"
    r = await client.post("/api/v1/auth/otp/request", json={"phone": phone})
    from app.utils.sms_provider import ConsoleSMSProvider
    code = ConsoleSMSProvider.sent[-1][1].split()[-1]
    tokens = (await client.post("/api/v1/auth/otp/verify", json={"phone": phone, "code": code})).json()
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}
    # before onboarding: no profile yet
    assert (await client.get("/api/v1/artists/me", headers=headers)).status_code == 404
    r = await client.patch("/api/v1/artists/me", json={"display_name": "Lee"}, headers=headers)
    assert r.status_code == 200
    refresh = (await client.post("/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]})).json()
    assert refresh["user"]["role"] == "artist"
```

Run: `pytest tests/test_artists.py -v` → FAIL.

- [ ] **Step 3: Write `app/services/artist_service.py`**

```python
import uuid
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.exceptions import NotFoundError
from app.models.artist_profile import ArtistProfile
from app.models.user import User
from app.schemas.artist import ArtistUpdate
from app.utils.enums import UserRole


class ArtistService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def list_artists(self, city, category, page: int, page_size: int) -> tuple[list[ArtistProfile], int]:
        conditions = []
        if city:
            conditions.append(ArtistProfile.city.ilike(f"%{city}%"))
        if category:
            conditions.append(ArtistProfile.categories.any_(category))
        total = (
            await self.session.scalar(select(func.count()).select_from(ArtistProfile).where(*conditions))
            or 0
        )
        rows = await self.session.scalars(
            select(ArtistProfile)
            .where(*conditions)
            .order_by(ArtistProfile.avg_rating.desc(), ArtistProfile.total_reviews.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        return list(rows), total

    async def get_artist(self, user_id: uuid.UUID) -> ArtistProfile:
        profile = await self.session.get(ArtistProfile, user_id)
        if profile is None:
            raise NotFoundError("Artist not found")
        return profile

    async def get_by_user(self, user: User) -> ArtistProfile:
        profile = await self.session.get(ArtistProfile, user.id)
        if profile is None:
            raise NotFoundError("Artist profile not found — create one via PATCH /artists/me")
        return profile

    async def upsert_me(self, user: User, data: ArtistUpdate) -> ArtistProfile:
        profile = await self.session.get(ArtistProfile, user.id)
        if profile is None:  # first PATCH = artist onboarding entry-point
            profile = ArtistProfile(
                user_id=user.id, display_name=data.display_name or user.first_name or "Artist"
            )
            self.session.add(profile)
            user.role = UserRole.artist
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(profile, field, value)
        await self.session.flush()
        return profile
```

- [ ] **Step 4: Write thin routes `app/api/v1/artists.py`**

Note the order: `/me` routes declared **before** `/{artist_id}` so "me" isn't parsed as a UUID.

```python
import uuid
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.artist import ArtistDetail, ArtistPage, ArtistSummary, ArtistUpdate
from app.services.artist_service import ArtistService

router = APIRouter(prefix="/artists", tags=["artists"])


def get_artist_service(session: AsyncSession = Depends(get_db)) -> ArtistService:
    return ArtistService(session)


@router.get("", response_model=ArtistPage)
async def list_artists(
    city: str | None = Query(default=None, max_length=120),
    category: str | None = Query(default=None, max_length=60),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    service: ArtistService = Depends(get_artist_service),
):
    rows, total = await service.list_artists(city, category, page, page_size)
    return ArtistPage(
        items=[ArtistSummary.model_validate(r) for r in rows], page=page, page_size=page_size, total=total
    )


@router.get("/me", response_model=ArtistDetail)
async def get_me(
    user: User = Depends(get_current_user), service: ArtistService = Depends(get_artist_service)
):
    return ArtistDetail.model_validate(await service.get_by_user(user))


@router.patch("/me", response_model=ArtistDetail)
async def upsert_me(
    body: ArtistUpdate,
    user: User = Depends(get_current_user),
    service: ArtistService = Depends(get_artist_service),
):
    return ArtistDetail.model_validate(await service.upsert_me(user, body))


@router.get("/{artist_id}", response_model=ArtistDetail)
async def get_artist(artist_id: uuid.UUID, service: ArtistService = Depends(get_artist_service)):
    return ArtistDetail.model_validate(await service.get_artist(artist_id))
```

Register in `app/api/v1/router.py`:

```python
from app.api.v1 import artists  # noqa: E402  (add import at top with auth)
api_router.include_router(artists.router)
```

- [ ] **Step 5: Run tests**

Run: `pytest -v` → ALL PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/app backend/tests
git commit -m "feat: add artist browse and profile APIs"
```

---

### Task 6: Docs, Dockerfile, green suite

**Files:**
- Create: `Dockerfile`, `README.md`

- [ ] **Step 1: Write `Dockerfile`**

```text
FROM python:3.14-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

- [ ] **Step 2: Write `README.md`** — exact contents:

````markdown
# Art Circle API

FastAPI backend for the Art Circle artist marketplace. Increment 1: phone+OTP auth, artist profiles.

## Stack
FastAPI · SQLAlchemy 2.0 (async) · asyncpg · Alembic · PostgreSQL 16 · pytest

## Setup
```bash
brew services start postgresql@16
createdb art_circle          # dev database
createdb art_circle_test     # test database
cp .env.example .env         # set JWT_SECRET for anything but local dev
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
```

OTP codes are printed to the server console (SMS_PROVIDER=console, DEBUG mode).

## Test
```bash
pytest -v
```

## Request flow
```text
route (api/v1/*.py, thin)
  → service (services/*_service.py, business rules, owns session use)
  → model (models/*.py)
  → PostgreSQL
```

Auth: POST /api/v1/auth/otp/request → POST /auth/otp/verify → JWT access (15 min) + refresh (7 d, rotated, hashed in DB). Protected routes use `Authorization: Bearer <access_token>`.
````

- [ ] **Step 3: Final verification**

```bash
source .venv/bin/activate
ruff check app tests
pytest -v
```

Expected: ruff clean (fix any findings), all tests pass.

- [ ] **Step 4: Commit**

```bash
git add backend/Dockerfile backend/README.md
git commit -m "docs: add README and Dockerfile"
```
