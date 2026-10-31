---
name: data-layer-stack
description: Governs the Postgres data layer of the GetReady backend (SQLAlchemy 2 async + asyncpg + Alembic, hosted on Supabase or Neon, with a local Docker Compose stack) using a capability-first decision ladder and one approved tool per capability, curated from awesome-postgres, awesome-supabase and awesome-compose. Use when designing or migrating a schema, adding an index/constraint/extension, choosing a pooler or connection string, touching backend/docker-compose.yml, deciding whether a Supabase feature (Auth, Storage, Realtime, PostgREST, Edge Functions, RLS) applies, or reviewing data-layer code for a competing tool.
---

# Data Layer Stack (PostgreSQL + Alembic + Compose)

Curated against [dhamaniasad/awesome-postgres](https://github.com/dhamaniasad/awesome-postgres)
(`954766a`), [lyqht/awesome-supabase](https://github.com/lyqht/awesome-supabase) (`11d47fd`) and
[docker/awesome-compose](https://github.com/docker/awesome-compose) (`30f4b7f`), all CC0. The
approved table is [LIBRARIES.md](./LIBRARIES.md).

`.qoder/rules/fastapi-best-practices.md` (Database, Migrations) is the hard law and wins over this
skill. Runtime/library governance for the API itself lives in `fastapi-stack/SKILL.md`; this skill
owns the storage half.

## The defining facts about this data layer

- **One database, one engine.** `backend/app/core/database.py` builds a single async engine from
  `settings.database_url` (`postgresql+asyncpg://`), with `pool_pre_ping`, `pool_size` 10,
  `max_overflow` 10, `pool_recycle` 1800 s, `pool_timeout` 10 s and a hard
  `statement_timeout` of 15 s set through `connect_args`. `get_db` owns the transaction — commit on
  success, rollback on raise — and **must** be depended on as `Depends(get_db, scope="function")` so
  the commit lands before the response is sent (`tests/test_platform.py` asserts this).
- **Alembic is the only schema writer.** 40 revisions in `alembic/versions/`, filename template
  `%(year)d-%(month).2d-%(day).2d_%(slug)s`, both directions required, and `tests/test_migrations.py`
  checks every constraint name at head against the `MetaData` convention in
  `app/shared/models.py`.
- **Supabase is used as managed Postgres and nothing else.** There is no `@supabase/supabase-js`,
  no PostgREST call, no Supabase Auth/Storage/Realtime/Edge Function anywhere in the repo. Auth is
  FastAPI OTP + JWT (`app/core/auth.py`), storage is R2/Cloudinary (`app/upload`), push is Expo
  (`app/notification/push.py`).
- **Two hosts, split by environment.** `.env`, `.env.dev` and `.env.local` point at the Supabase
  **session pooler** (`aws-0-eu-west-1.pooler.supabase.com:5432`, user `postgres.<ref>`); `.env.prod`
  points at Neon (`us-east-2`), which is also what `render.yaml` staging is placed next to. Treat a
  connection string as environment-specific, never as "the database".
- **Authz is in Python, not in Postgres.** Zero RLS policies exist. Role enforcement is
  `require_role(...)` wrapped as the audited admin guard in `app/core/auth.py`, mounted per
  `app/*/admin_router.py`. Postgres therefore has no second gate — the grants are the gate.

## Decision ladder — run in order, stop at the first hit

1. **Postgres itself.** A `CHECK`, a partial index, a generated column, an exclusion constraint
   (`btree_gist`, as used for booking overlap), `pg_trgm` + `gin`, JSONB, window functions, a CTE.
   Rules §Database is explicit: SQL-first, Pydantic-second — complex joins and aggregations belong
   in SQL, not in Python post-processing.
2. **Something in `app/core/database.py` or `app/shared/`.** `Base` + `NAMING_CONVENTION`,
   `TimestampMixin`, `keyset()` + opaque cursors (`app/shared/pagination.py`, `cursor.py`),
   `split_page`, search helpers. Extend these; do not re-implement paging or naming per domain.
3. **A SQLAlchemy 2 / Alembic built-in.** `op.execute`, `op.create_index(..., postgresql_using="gin")`,
   `op.create_check_constraint`, `sa.text()` with bound params. An extension goes through
   `op.execute("CREATE EXTENSION IF NOT EXISTS ...")` inside the migration, exactly as
   `2026-10-18_booking_overlap_guard_and_search_indexes.py` does for `btree_gist` and `pg_trgm`.
4. **An installed dependency** — `sqlalchemy[asyncio]` 2.1.5, `asyncpg` 0.32, `alembic` 1.20,
   `greenlet` (a real runtime requirement of the async engine; keep it in the lock).
5. **A row in [LIBRARIES.md](./LIBRARIES.md)** marked `candidate` — install it, do not re-survey.
6. **Only then** propose a new dependency or extension, and record it in LIBRARIES.md **and** in
   `.qoder/rules/fastapi-best-practices.md` in the same change. If the capability already has an
   owner (Alembic, `scripts/maintenance.py`, the platform's PITR), the answer is *no* unless the
   change removes the owner.

## Where the awesome lists disagree with this repo

The lists describe everything Postgres and Supabase can do; this repo uses a narrow slice.

| List says | Here | Why |
| --- | --- | --- |
| Supabase = Postgres + Auth + Storage + Realtime + Edge Functions + instant APIs | **Postgres only** | Every one of those has an owner in FastAPI/R2/Expo. Adopting one means deleting ours, not adding theirs |
| `supabase` CLI for local dev (`supabase start`, `supabase db push`) | **Alembic + `backend/docker-compose.yml`** | Two schema writers is the failure mode. The CLI's `db push` would bypass the reversible-migration contract that CI verifies |
| Row-level security as the authorisation model | **no RLS; FastAPI role checks** | 61 mapped tables already have one authorisation system. RLS would be a second, unreviewed one — and it silently does nothing for a connection that owns the table |
| PostgREST / Hasura / PostGraphile / pREST | **FastAPI** | The API is the product: error contract, audit log, rate limits, request ids all live in `app/core` |
| pgBouncer / pgpool-II | **Supavisor (Supabase) or Neon's pooler** | A second pooler in front of a managed pooler multiplies connection limits instead of solving them |
| Citus, TimescaleDB, ParadeDB, `pg_search`, AGE, PostGIS, pgvector, OrioleDB | **not installed** | Each is a platform decision (Supabase and Neon support different subsets) and CI migrates a vanilla `postgres:17`. Ask before adding one |
| `pg_cron` / `pg_timetable` for scheduled jobs | **`scripts/maintenance.py` + an external scheduler** | Housekeeping is application logic (prune OTP codes, dead refresh tokens, closed rate-limit windows). Moving it into the DB would make the schema the scheduler |
| Work queues: pgmq, Graphile Worker, pg-boss, river, DBOS, BeanQueue | **none** | This is the known missing durable queue (see `fastapi-stack`). `pgmq` is the one option that adds no new service, so it is the first look if a queue is approved |
| Migration tooling: Atlas, Flyway, Sqitch, migra, pgschema, pgroll, pg-schema-diff | **Alembic + `alembic check`** | Replacing the migrator rewrites 40 reversible revisions and the CI up/check/down/up run. A *linter* (pgfence-style, advisory only) is a candidate; a replacement migrator is not |
| Backups: pgBackRest, Barman, WAL-G, pg_probackup | **platform PITR** | We do not run Postgres. Back up `AADHAAR_ENCRYPTION_KEY` separately — stored Aadhaar numbers are unreadable without it |
| Monitoring: postgres_exporter, pgmetrics, pgwatch2, PgHero, pg_ash, pgvitals | **platform dashboards + `app/core/metrics.py`** | The API's Prometheus metrics are HTTP metrics. Catalog-reading tools (`pg_ash`, `pgvitals`) are candidates because they need no agent |
| GUI: pgAdmin, DBeaver, TablePlus, pgweb, Beekeeper | **developer-local only** | Never a dependency; never in `requirements*.txt` |
| Compose samples (react-express-mysql, fastapi, postgresql-pgadmin, …) | **reference only** | Our compose is three services over the production Dockerfile. Copying a sample in would fork the image and the migration step |

## Connection strings — the part that actually breaks

- **Session pooler, port 5432.** Works with asyncpg. The user is `postgres.<project-ref>`, not
  `postgres`.
- **Transaction pooler, port 6543: forbidden.** Supavisor's transaction mode does not keep
  prepared statements, and asyncpg prepares by default → intermittent
  `prepared statement "__asyncpg_stmt_…" does not exist`.
- **Direct host (`db.<ref>.supabase.co`)** is IPv6-only on this project; Render's network is IPv4,
  so a direct string works from a laptop and fails in staging. That failure looks like a hang, not
  an error.
- **Neon strings carry libpq params** (`sslmode`, `channel_binding`) that asyncpg rejects with a
  `TypeError` before uvicorn binds — the service then shows no HTTP response at all. Strip them;
  `render.yaml` records this.
- **Pool arithmetic before raising a pool setting:** each worker may open `pool_size +
  max_overflow` = 20 connections. `Dockerfile` sets `WEB_CONCURRENCY=2` (40), `render.yaml` sets 1
  (20). Compare that against the project's connection limit for the pooler mode in use, not against
  the `db_*` defaults.
- **`statement_timeout` 15 s** is set per connection. A migration or a one-off backfill that needs
  longer must set it explicitly for that session rather than raising the global default.

## Local stack (`backend/docker-compose.yml`)

Three services, and the order is the contract:

- `db`: `postgres:17`, host port **5433** (so a local 5432 is left alone), db `art_circle`, healthcheck
  `pg_isready` — `migrate` waits on `service_healthy`.
- `migrate`: the production image running `alembic upgrade head`; `api` waits on
  `service_completed_successfully`, so the API never serves against an unmigrated schema.
- `api`: the production image on `8001:8000`, `ENVIRONMENT=local` so fake storage and console SMS
  apply.

Two traps:

- `environment:` **overrides** `env_file: .env`, which is why `DATABASE_URL` is restated per service.
  Delete that override and the container silently writes to the cloud database named in `.env`.
- No named volume is declared, so the data lives in an anonymous volume: `docker compose down` keeps
  it, `docker compose down -v` destroys it. That is also why the default `.env` points at the cloud
  pooler — compose is the opt-in check, not the everyday dev database.

## Access control with a published schema

Supabase publishes schema `public` through PostgREST to the `anon` and `authenticated` roles, and its
default privileges grant those roles on new tables created by `postgres`. Migrations connect as
`postgres`, so **every table-creating migration is a potential new public endpoint**.

After any migration that creates a table, verify:

```sql
-- must return zero rows for tables that hold user data
select grantee, privilege_type, table_name
from information_schema.role_table_grants
where table_schema = 'public' and grantee in ('anon', 'authenticated');

-- and check what future tables will inherit
select pg_get_userbyid(defaclrole) as grantor, defaclobjtype, defaclacl from pg_default_acl;
```

The lockdown on this project is a manual step (it is not in `alembic/versions/`), so it is not
replayed by CI. If a future migration creates `user_*`, `artist_kyc`, `auth_*` or any new PII table,
re-run the revoke or the table is readable with the publishable key.

## Migrations — the checklist

```bash
cd backend
.venv/bin/alembic revision --autogenerate -m "<what changes>"   # writes YYYY-MM-DD_<slug>.py
# read the generated file: autogenerate misses CHECKs, partial indexes and data moves
# then hand-write downgrade() — a migration without one fails CI
.venv/bin/alembic upgrade head
.venv/bin/alembic check          # models and head agree
.venv/bin/alembic downgrade -1 && .venv/bin/alembic upgrade head
```

Rules that are not negotiable here:

- **Reversible both ways.** CI runs up → check → down to base → up on an empty `postgres:17`.
- **No model imports in migrations.** Revisions replay static SQL/`op.*` calls; `alembic/env.py`
  only exposes metadata during `--autogenerate` and `check` (`_comparing_to_models()`), so a
  migration that imports a model breaks replay.
- **Names come from the convention.** `ix_<table>_<column>`, `uq_<table>_<column>`,
  `ck_<table>_<name>`, `fk_<table>_<column>_<referred>`, `pk_<table>`. `tests/test_migrations.py`
  fails the suite on drift.
- **Existing revisions are frozen.** Never edit a revision that has run anywhere; add a new one.

## Gates before finishing

```bash
cd backend
.venv/bin/ruff check . && .venv/bin/ruff format --check .
.venv/bin/mypy
.venv/bin/alembic check
.venv/bin/pytest -q --cov=app --cov-report=term-missing:skip-covered

docker compose -f docker-compose.yml up --build    # smoke: db healthy → migrate → api
```

Plus, when a table was created: the two grant queries above.

## Known gaps worth acting on

Ranked by risk. One capability per commit.

1. **Prod/staging and dev run on different providers.** Supabase (eu-west-1) serves `.env`,
   `.env.dev`, `.env.local`; Neon (us-east-2) serves `.env.prod`. Two managed Postgres platforms
   means two extension subsets, two pooler behaviours and two restore procedures to know. Pick one
   deliberately — the migration itself is connection-string-only (`database.py` has no provider SDK).
2. **The grant lockdown is not code.** It lives in a dashboard, not in `alembic/versions/`, so CI
   cannot prove it and a new table silently re-opens `public`. Either add it as a re-runnable
   migration/policy step or add a CI assertion against a Supabase-shaped database.
3. **No durable queue.** Inherited from `fastapi-stack` gap 1. `pgmq` is the option that adds no new
   service; taskiq/dramatiq bring Redis and change the deployment shape.
4. **No scheduled housekeeping.** `scripts/maintenance.py` is documented as "run it every few
   minutes" and CI only smoke-runs it. `pg_cron` is the alternative owner, not an addition.
5. **No database-level observability.** The metrics endpoint covers HTTP only; there is no
   `postgres_exporter`, no slow-query review, and nothing asserts an `EXPLAIN` on a new query.
6. **`.env` (local) targets the shared cloud database.** Compose on 5433 is opt-in, so everyday dev
   writes to Supabase and a bad local test can damage seed data that other work depends on.
7. **`AADHAAR_ENCRYPTION_KEY` backup is manual.** Losing it makes stored KYC permanently unreadable,
   and no automated check compares the key against existing ciphertext.
8. **No data-layer property tests.** `hypothesis` would pay off on `app/shared/cursor.py` (round-trip
   and rejection) and on booking overlap constraints, where the current coverage is example-based.
