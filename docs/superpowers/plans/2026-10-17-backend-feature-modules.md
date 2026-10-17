# Backend restructure: feature modules with router → service → repository

Date: 2026-10-17 · The product owner asked for the code to be organised "to enterprise standard". Chosen scope: full (feature modules plus a repository layer), done now, before more features.

**This is a pure refactor.** The HTTP API, the database schema, the migrations and the behaviour all stay the same. The contract tests (`backend/tests`, 155 tests) must stay green after every step. Only their `import` lines may change, never an assertion.

## Target layout

```
backend/app/
  main.py                 create_app(): middleware, error handlers, mounts app/api.py
  api.py                  api_router (/api/v1): includes every module router, in the order noted below
  registry.py             imports every module's models so Base.metadata is complete (Alembic env + tests use it)
  core/                   cross-cutting infrastructure, no business rules
    config.py  database.py  exceptions.py  security.py  crypto.py
    auth.py               get_current_user, require_role, current_customer/current_artist/current_admin
  shared/                 small helpers any module may use
    models.py             Base, TimestampMixin (was models/base.py)
    enums.py  clock.py  cursor.py  search.py
    pagination.py         keyset helper(s) used by repositories
  modules/
    auth/       router.py service.py repository.py schemas.py models.py (OtpCode, RefreshToken) sms.py
    users/      router.py service.py repository.py schemas.py models.py (User, UserRoleGrant)
    uploads/    router.py storage.py
    catalog/    router.py (public /categories, /cities) admin_router.py (categories + service templates)
                service.py template_service.py repository.py schemas.py models.py (Category, ServiceTemplate)
    artists/    router.py (/artists/me…) admin_router.py (/admin/artists…, /admin/custom-services…)
                service.py admin_service.py custom_service_review.py repository.py schemas.py presenters.py
                models.py (ArtistProfile, ArtistServiceItem, PortfolioPhoto, ArtistKyc, AadhaarReveal) aadhaar.py
    bookings/   router.py (customer /bookings) artist_router.py (/artists/me/bookings, /dashboard)
                admin_router.py (/admin/bookings) service.py admin_service.py repository.py schemas.py
                presenters.py models.py rules.py (was utils/booking_rules.py)
    reviews/    router.py (POST /bookings/{id}/review) artist_router.py (/artists/me/reviews)
                admin_router.py (/admin/reviews) service.py repository.py schemas.py presenters.py
                models.py filter.py (was utils/review_filter.py)
    directory/  router.py (public /artists, /artists/{id}, /availability, /reviews) service.py repository.py
                schemas.py presenters.py
    overview/   router.py (/admin/overview) service.py (reads other modules' repositories)
  scripts/make_admin.py
```

In `api.py`, every `/artists/me…` router must be registered **before** `directory`. Otherwise "me" is read as an artist id.

## Layer rules

| Layer | May do | Must not do |
|---|---|---|
| `router.py` | Parse the request into schemas, call one service method, map the result through `presenters.py` to a response schema, and set status codes. Service factories for `Depends` are defined in the module. | Query the database or hold business rules. |
| `service.py` | Business rules, state transitions, permissions beyond the role check, and transactions (commit early where the current code does: bookings, reviews, Aadhaar reveal). Returns models, dataclasses or NamedTuples. | Build Pydantic response schemas or write SQLAlchemy `select()`s itself. |
| `repository.py` | All SQLAlchemy queries for the module's tables: get, list, count, aggregate, keyset paging, `FOR UPDATE` locks. Returns models or row tuples. A `get_or_404`-style helper may raise `NotFoundError`. | Know about schemas. |
| `presenters.py` | Pure functions that turn a model or row into a response schema (today's `booking_out`, `profile_out`, `own_out`, `admin_out`). They take `ImageStorage` to build URLs. | Do I/O. |
| `schemas.py` | Pydantic request and response models only. | Import services or repositories. |

Modules use each other only through a **repository or service**, never through a router. These dependencies are allowed:
- `directory` → the `bookings`, `reviews`, `artists` and `catalog` repositories
- `reviews` → the `bookings` and `artists` repositories
- `bookings` → the `artists` repository, and the `reviews` repository (for the outer join that adds review fields)
- `overview` → the `bookings`, `reviews` and `artists` repositories

There must be no import cycles: `python -c "import app.main"` has to work.

## Steps

Each step ends with `pytest -q` green, `ruff check app` no worse than before the step, and a commit.

1. **`core/` and `shared/`:**
   - Move the base models, enums, clock, cursor and search helpers.
   - Split `core/dependencies.py`: current-user and role checks go to `core/auth.py`, and each service factory goes to its module.
   - Add `registry.py` and point `alembic/env.py` and `tests/conftest.py` at it.
2. **`auth`, `users` and `uploads`** modules.
3. **`catalog`** module.
4. **`artists`** module, including admin review, custom-service review and Aadhaar.
5. **`bookings`** module. Pull the repository (busy ranges, row queries, keyset pages, the expiry UPDATE, counts) and the presenters out of `booking_service.py` and `admin_booking_service.py`.
6. **`reviews`** module. Move the `POST /bookings/{id}/review` route here; its path does not change.
7. **`directory` and `overview`** modules. Overview moves out of `admin_booking_service`.
8. **Clean up:**
   - Delete the emptied `api/v1`, `services`, `schemas`, `models` and `utils` folders.
   - Update the "Project structure" section of `backend/README.md`.
   - Do one final full run.

Other agents work in `mobile/` at the same time. Use plain `mv` (not `git mv`) and stage with `git add backend/` only, so nothing outside `backend/` gets staged.
