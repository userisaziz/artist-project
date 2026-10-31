# Approved tools — data layer

One tool per capability. `installed` = in `backend/requirements*.txt` or a checked-in config.
`candidate` = pre-approved for that capability. `rejected` = an owner already exists.

Source lists: [awesome-postgres](https://github.com/dhamaniasad/awesome-postgres) `954766a`,
[awesome-supabase](https://github.com/lyqht/awesome-supabase) `11d47fd`,
[awesome-compose](https://github.com/docker/awesome-compose) `30f4b7f` — all CC0.

## Installed

| Capability | Pick | Version | Notes |
| --- | --- | --- | --- |
| Driver | `asyncpg` | 0.32.0 | Prepares statements by default, which breaks behind a transaction-mode pooler (port 6543) |
| ORM / SQL toolkit | `sqlalchemy[asyncio]` | 2.1.5 | 2.x style only: `select()`, `Mapped`, `mapped_column` |
| Async bridge | `greenlet` | in the lock | Real runtime requirement of the async engine — never drop it |
| Migrations | `alembic` | 1.20.0 | 40 reversible revisions; `alembic check` is the gate |
| Schema model | `app/shared/models.py` (`Base` + `NAMING_CONVENTION` + `TimestampMixin`) | — | Names are asserted by `tests/test_migrations.py` |
| Paging | `app/shared/pagination.py` (`keyset`, `split_page`) + `cursor.py` | — | Opaque base64 cursors; offset fallback for orders keyset cannot follow |
| Search | `pg_trgm` + `gin` indexes | extension | Created in `2026-10-18_booking_overlap_guard_and_search_indexes.py` |
| Range integrity | `btree_gist` exclusion constraint | extension | Booking overlap guard, same migration |
| Local stack | `backend/docker-compose.yml` | postgres:17 | db → migrate → api; host port 5433 |
| CI database | `postgres:17` service in `.github/workflows/backend.yml` | — | Proves migrations up/check/down/up on vanilla Postgres |
| Managed Postgres | Supabase (dev/local) + Neon (prod/staging) | — | Connection-string-only coupling; no provider SDK |

## Candidates (pre-approved, not installed)

| Capability | Pick | Why | Cost |
| --- | --- | --- | --- |
| Durable queue, no new service | `pgmq` | Postgres-native queue via `SKIP LOCKED`; no Redis, no new deployment unit | A new extension on every provider we use; a worker process still has to exist |
| Catalog-based DB insight | `pg_ash` or `pgvitals` | Pure-SQL probes over `pg_stat_*`; works on managed Postgres, no agent, no superuser | Manual runs until something schedules them |
| Migration lint | `pgfence`-style advisory lint (or an in-repo `alembic` hook) | Catches lock-taking DDL before production; Alembic stays the only writer | A dev-only tool plus a CI step; must not become a second migrator |
| Property-based tests | `hypothesis` | `app/shared/cursor.py` and the booking-overlap constraint are exactly the shapes examples miss | Test-only dep in `requirements-dev.txt` |
| Schema diff review | `migra` / `pg-schema-diff` (read-only use) | Confirms head vs a real database without writing | Only useful against a disposable database |
| Metric export | `postgres_exporter` | Prometheus series for connections, locks, bloat next to the API's HTTP metrics | A second scrape target; today there is no scraper at all |
| Fixtures | `polyfactory` | Fills Pydantic models for seed scripts | Test/seed-only dep |

## Rejected

| Capability | Rejected | Already owned by |
| --- | --- | --- |
| Migrations | Atlas, Flyway, Sqitch, pgschema, pgroll, `supabase db push` | Alembic (40 revisions + CI replay contract) |
| API over Postgres | PostgREST, Hasura, PostGraphile, pREST | FastAPI (`app/router.py`, error contract, audit, rate limits) |
| Connection pooling | PgBouncer, pgpool-II | Supavisor (Supabase) / Neon pooler |
| Auth / storage / realtime | Supabase Auth, Storage, Realtime, Edge Functions | `app/core/auth.py`, `app/upload` (R2/Cloudinary), Expo push |
| Authorisation | RLS policies, Permit.io, Clerk | `require_role(...)` + audited admin guard |
| Scheduling | `pg_cron`, `pg_timetable`, APScheduler | `scripts/maintenance.py` + an external scheduler |
| HA / replication | Patroni, repmgr, Stolon, pg_auto_failover, BDR | The managed platform |
| Backups | pgBackRest, Barman, WAL-G, pg_probackup, wal-e | Platform PITR; `AADHAAR_ENCRYPTION_KEY` backed up out of band |
| Scaling | Citus, TimescaleDB, ParadeDB, OrioleDB, YugabyteDB | Plain Postgres until a measured need |
| Admin panels | `sqladmin`, pgAdmin in-app, Mathesar, Teable, Directus | `admin/` (React console over the API) — an ORM-bypassing panel would skip the role checks |
| Full-text search service | ZomboDB, Elasticsearch, PGroonga | `pg_trgm` today; revisit only with a search requirement that trigram cannot meet |
| Local BaaS | `supabase start`, Supabase CLI local stack | `backend/docker-compose.yml` |
| Perf tooling as a dependency | PgHero, pganalyze, EverSQL, pgMustard | Platform dashboards; `EXPLAIN` by hand |

## Adding a row

Extensions are a **platform** decision: confirm the provider supports it, create it inside the
migration with `CREATE EXTENSION IF NOT EXISTS`, and prove it on CI's vanilla `postgres:17` (contrib
extensions are fine; anything else needs a CI image change). Then move the row from Candidates to
Installed with the version from `requirements.lock`.
