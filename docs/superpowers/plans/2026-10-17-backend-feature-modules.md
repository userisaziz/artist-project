# Backend restructure: layer folders (routes → controllers → services → repositories), one subfolder per feature

Date: 2026-10-17 · The product owner asked for "enterprise standard" organisation and **folders separated by layer, so the structure is clear at a glance** (e.g. `routes/artist/artist.py`, `controllers/artist/artist.py`, `services/artist/artist.py`). This supersedes the first draft of this plan, which used feature modules (`app/modules/<feature>/`).

**This is a pure refactor.** The HTTP API, the database schema, the migrations and the behaviour all stay the same. The contract tests (`backend/tests`) must stay green after every step. Only their `import` lines may change, never an assertion.

## Target layout

Features (singular names): `auth`, `user`, `upload`, `catalog`, `artist`, `booking`, `review`, `directory`, `overview`.

```
backend/app/
  main.py                         create_app(): middleware, error handlers, mounts routes.api_router
  core/                           infrastructure: config, database, exceptions, security, crypto,
                                  auth.py (current user, role checks)
  shared/                         models.py (Base, TimestampMixin), enums, clock, cursor, search, pagination
  routes/
    __init__.py                   api_router (/api/v1): includes every feature's routers, in the order below
    <feature>/<feature>.py        APIRouter: path, method, auth dependency, response_model, status code.
                                  Each handler is a one-line call to its controller.
    <feature>/admin.py, artist.py admin-only and artist-only routes for that feature
  controllers/<feature>/<feature>.py  request + user → service → response schema (mapping lives here, or in
                                      controllers/<feature>/presenters.py); service factories in dependencies.py
  services/<feature>/<feature>.py     business rules and transactions; return models or rows, never schemas.
                                      Extra rule files sit beside it: services/booking/rules.py,
                                      services/review/filter.py, services/artist/aadhaar.py, services/auth/sms.py
  repositories/<feature>/<feature>.py all SQLAlchemy queries (get, list, count, keyset pages, FOR UPDATE locks)
  schemas/<feature>/<feature>.py      Pydantic request and response models
  models/<feature>/<feature>.py       SQLAlchemy tables; app/registry.py imports them all for Alembic and tests
  scripts/make_admin.py
```

Example, the booking feature:

| Layer | File |
|---|---|
| Routes | `routes/booking/booking.py` (customer), `routes/booking/artist.py`, `routes/booking/admin.py` |
| Controller | `controllers/booking/booking.py` |
| Service | `services/booking/booking.py`, `services/booking/admin.py`, `services/booking/rules.py` |
| Repository | `repositories/booking/booking.py` |
| Schemas | `schemas/booking/booking.py` |
| Model | `models/booking/booking.py` |

In `routes/__init__.py`, every `/artists/me…` router must be registered **before** `directory`. Otherwise "me" is read as an artist id.

## Layer rules

Each layer only calls the one below it: routes → controllers → services → repositories → models.

| Layer | Does | Never |
|---|---|---|
| Routes | Declare the endpoint: path, method, auth, response model, status. | Hold logic. |
| Controllers | Turn a request into a service call, and turn the result into a response schema. | Query the database or hold business rules. |
| Services | Business rules, state transitions, transactions. Services commit early where the current code does: bookings, reviews, Aadhaar reveal. | Build response schemas or write `select()`s. |
| Repositories | Every query, plus locks and keyset paging. | Commit, or know about schemas. |
| Schemas, models | Data shapes and tables. | Import services or repositories. |

Features use each other only through services or repositories, never through routes or controllers. Allowed:
- directory → the booking, review, artist and catalog repositories
- review → the booking and artist repositories
- booking → the artist and review repositories
- overview → the booking, review and artist repositories

There must be no import cycles: `python -c "import app.main"` must work.

## Steps

After every step, the tests must be green, `ruff` must be no worse than before, and the step is committed. Stage `backend/` only, using plain `mv`.

1. `core/` and `shared/`, the model registry (done).
2. auth, user, upload. These were first moved into `modules/`; move them into the layer folders.
3. catalog.
4. artist.
5. booking.
6. review.
7. directory and overview.
8. Remove the old folders and update the "Project structure" section of `backend/README.md`.
