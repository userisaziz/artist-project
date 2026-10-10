# Backend Increment 2 — Artist onboarding + admin approval (plan)

Spec: `docs/superpowers/specs/2026-10-10-increment2-artist-onboarding-design.md`. The mobile and admin plans follow once this API is in place.

Each step ends green: `.venv/bin/pytest -q` and `.venv/bin/ruff check .`.

1. **Errors and settings**
   - `ValidationError` (422, `validation_error`) and `ForbiddenError` (403, `forbidden`).
   - `AppError.details` is merged into the JSON body; the submit step uses it for its `missing` list.
   - Settings: `storage_provider` (`fake | cloudinary`), the Cloudinary keys, `cities`, `admin_origins` (CORS when `DEBUG=false`).
2. **Models and migration #3**
   - `ArtistStatus` enum.
   - `Category`, `ArtistProfile`, `artist_categories`, `ArtistService`, `PortfolioPhoto`.
   - A hand-written migration that seeds the six categories.
   - Check: the migration contract test lists the new tables; `alembic downgrade -1 && upgrade head` works on the test DB.
3. **Storage seam** (`app/services/storage.py`)
   - The `ImageStorage` ABC.
   - `FakeStorage`.
   - `CloudinaryStorage`: SHA-1 signed upload form, `destroy`, URL variants. Pure httpx; no SDK.
   - `get_storage()`.
   - Tests: the signature matches Cloudinary's documented algorithm; `owns` rejects other folders and `..`.
4. **Catalog and uploads**
   - `GET /categories`, `GET /cities`, `POST /uploads/signature` (artist only).
5. **Artist profile API** (`ArtistService`)
   - `GET /artists/me`.
   - `PUT /artists/me/profile`.
   - Service add, edit and delete.
   - Photo add, delete and reorder.
   - Submit: checks completeness and the edit lock.
   - Tests: CRUD, ownership, `missing` list, 409 while pending, customer gets 403.
6. **Admin API** (`AdminArtistService`)
   - List by status with cursor paging, detail, approve, reject.
   - `app/scripts/make_admin.py`.
   - Tests: non-admin gets 403; approve/reject transitions; reject → edit → resubmit.
7. **Docs**: README endpoint table and `.env.example` entries.
