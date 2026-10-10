# Increment 2 — Artist onboarding, Cloudinary uploads and the admin approval app

Date: 2026-10-10 · Status: draft for review

## Goal

An artist who picked "Offer my services" on Choose role can build a profile (photo, business name, categories, city), add services with prices, upload a portfolio, and submit it. An admin approves or rejects it from a separate web app. Approved artists become the supply that the customer flow (Increment 3) will browse and book.

## Decisions already made (2026-10-10)

| Decision | Choice | Why |
|---|---|---|
| Order | Artist side before customer side | Customers need real artists to browse; no demo seed data |
| Onboarding scope | Core steps: Intro → Profile → Services → Portfolio → In review | The design draws Profile (step 1) and Portfolio (step 5) of "9 steps"; ID/KYC, payout bank details and travel area/availability come later |
| Photo storage | Cloudinary now, behind a storage seam | Image transforms through the URL; the user may migrate later, so the DB stores provider-neutral keys, never full Cloudinary URLs |
| Approval | Separate admin web app (React + Vite, `admin/`) | Admin code never ships in the mobile app; the design's "Admin console → KYC review" screen is the reference |

## Out of scope (this increment)

ID/KYC documents, payout/bank details, travel area, weekly availability, the artist dashboard/requests/calendar/messages (the artist home stays the placeholder once approved), editing a profile after approval, posts/shop, the customer flow, other admin console pages.

## 1. Data model (backend, Alembic migration #3)

- **`categories`**: `id`, `slug` (unique), `name`, `sort_order`, `is_active`. The migration seeds the design's six: Mehendi, Makeup, Hair, Photography, Decor, Tattoo.
- **`artist_profiles`**: `id`, `user_id` (unique FK → users), `business_name`, `city`, `bio` (nullable), `photo_key` (nullable), `status` enum `draft | pending | approved | rejected` (default `draft`), `rejection_reason` (nullable), `submitted_at`, `reviewed_at`, `reviewed_by` (FK → users, nullable), timestamps.
- **`artist_categories`**: (`artist_id`, `category_id`) primary key.
- **`artist_services`**: `id`, `artist_id`, `category_id`, `name`, `price_paise` (int, > 0), `duration_minutes` (int, > 0), `description` (nullable), `sort_order`, timestamps.
- **`portfolio_photos`**: `id`, `artist_id`, `storage_key`, `width`, `height`, `sort_order`, `created_at`. The lowest `sort_order` is the cover.

Cities: a fixed list in settings (`Bangalore`, `Mumbai`, `Delhi NCR`, `Hyderabad`, `Chennai`, `Pune`), validated on write and served by `GET /cities`. A table can replace it when admins need to edit it.

## 2. Storage seam (Cloudinary)

`app/services/storage/`:
- `ImageStorage` protocol: `upload_params(owner_id, purpose)`, `owns(key, owner_id, purpose)`, `url(key, variant)`, `delete(key)`.
- `CloudinaryStorage` implements it. Settings: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.
- `FakeStorage` is used by tests and in development without keys (`STORAGE_PROVIDER=fake`).

Upload flow (the app uploads straight to Cloudinary; the image bytes never pass through our server):
1. App → `POST /api/v1/uploads/signature {purpose: "artist_photo" | "portfolio"}`. The backend returns `{upload_url, fields}`, a signed form with the folder fixed to `artists/{user_id}/{purpose}`.
2. The app resizes the image on the device (longest side 2048 px, JPEG quality 0.8) and posts it to `upload_url`.
3. The app sends the returned `public_id` to our API as `key`. The backend accepts only keys inside the caller's own folder (`owns`).

API responses carry ready-made URLs (`url(key, "thumb" | "card" | "full")`), so the clients never build Cloudinary URLs. Migrating later means a new `ImageStorage` class plus copying the files across.

## 3. API (all under `/api/v1`)

Artist endpoints require `role = artist`.

| Method | Path | Notes |
|---|---|---|
| GET | `/categories` | Active categories, sorted |
| GET | `/cities` | Fixed list |
| POST | `/uploads/signature` | Signed Cloudinary upload form |
| GET | `/artists/me` | Profile + categories + services + photos + status; `404 not_found` before the first save |
| PUT | `/artists/me/profile` | `{business_name, city, category_ids[], photo_key?, bio?}`; creates the `draft` row on first call |
| POST | `/artists/me/services` | `{category_id, name, price_paise, duration_minutes, description?}` |
| PATCH / DELETE | `/artists/me/services/{id}` | Own services only |
| POST | `/artists/me/photos` | `{key, width, height}`; appended last |
| DELETE | `/artists/me/photos/{id}` | Also deletes the file from storage |
| PUT | `/artists/me/photos/order` | `{photo_ids[]}`, the full list in the new order |
| POST | `/artists/me/submit` | Checks completeness, then `draft`/`rejected` → `pending` and sets `submitted_at` |

Completeness rule for submit: a photo, a business name, at least one category, a city, at least one service, and at least six portfolio photos. Failures return `422 validation_error` with a `missing` list.

Editing rule: writes are allowed only in `draft` or `rejected`. In `pending` or `approved` they return `409 conflict` (editing after approval comes later).

Admin endpoints require `role = admin`:

| Method | Path | Notes |
|---|---|---|
| GET | `/admin/artists?status=pending` | Paginated (`limit`, `cursor`), oldest submission first |
| GET | `/admin/artists/{id}` | Full profile, with the user's name and phone |
| POST | `/admin/artists/{id}/approve` | `pending` → `approved`; sets `reviewed_at`/`reviewed_by` |
| POST | `/admin/artists/{id}/reject` | `{reason}` (required, ≤ 500 characters); `pending` → `rejected` |

Admins sign in with the same phone + OTP endpoints. Admin accounts are made with a backend command, `python -m app.scripts.make_admin +91XXXXXXXXXX`; `admin` is never self-assigned. The backend adds CORS for `ADMIN_ORIGINS` (default `http://localhost:5173`).

## 4. Mobile (artist side)

Routing: `destination()` gains artist sub-states driven by `GET /artists/me`:
- No profile, `draft` or `rejected` → `/artist/onboarding/*`
- `pending` → `/artist/in-review`
- `approved` → `/artist` (the placeholder home for now)

Screens (Atelier style, reusing `FormScreen`, `FormHeading`, `AppTextField`, `FieldHalo`):
1. **Intro**: the design's "Turn your craft into bookings", with three benefit lines and "Let's get started". The copy says "3 short steps". The "Get paid securely, every Monday" line is dropped until payouts exist.
2. **Profile** (step 1 of 3): photo picker, business name, category chips (multi-select), city picker.
3. **Services** (step 2 of 3): a list of added services and an "Add service" sheet (category, name, price ₹, duration). Continue needs at least one service. The design doesn't draw this step, so it follows the Profile step's style.
4. **Portfolio** (step 3 of 3): a grid where the first tile is marked "Cover", "+ Add" picks several photos, each tile shows upload progress, long-press removes a photo, and the button reads "Continue · n of 6 photos" until there are six. Reordering is by "Make cover" only; full drag reordering comes later.
5. **In review**: the design's timeline (Profile submitted → Portfolio check → Go live) and a Sign out link. When rejected, it shows the reason and "Edit and resubmit".

Each Continue saves to the server, so quitting mid-way resumes at the first incomplete step.

New dependencies: `@tanstack/react-query` (planned since Increment 1), `expo-image-picker` and `expo-image-manipulator` (both work in Expo Go). The mock transport gains every new endpoint, with a fake upload that returns a local URI as the key, so the app and the tests run without a backend.

## 5. Admin web app (`admin/`)

React + Vite + TypeScript, with TanStack Query and React Router. The look follows the design's admin console: a sidebar, then the "Verification" queue.

- **Sign in**: phone, then OTP (the same `/auth` endpoints), then `GET /users/me`. A non-admin sees "This account isn't an admin" and is signed out.
- **Queue** (`/artists?status=pending`): a table with photo, business name, city, categories and submitted time, plus tabs for Pending, Approved and Rejected.
- **Review** (`/artists/:id`): profile header, services table, portfolio grid (click to enlarge), and **Approve** and **Reject** (the dialog requires a reason).
- **Tokens**: the access token is kept in memory and the refresh token in `localStorage`. That's acceptable for an internal tool; it moves to an httpOnly cookie before the app is exposed publicly.

## 6. Testing

- **Backend (pytest, real test DB, `FakeStorage`):**
  - Profile, service and photo CRUD.
  - Ownership checks on keys and ids.
  - Submit completeness, including the `missing` list.
  - The state machine: edits blocked in `pending`; reject → edit → resubmit.
  - Admin role enforcement and approve/reject transitions.
  - Signature contents (folder and signature).
- **Mobile (jest-expo against the mock transport):**
  - Choose role (artist) → Intro → Profile → Services → Portfolio (six mocked picks) → In review.
  - A rejected profile shows the reason and resumes editing.
  - Approved lands on the artist home.
- **Admin (Vitest + Testing Library with mocked fetch):**
  - A non-admin is refused.
  - The queue renders.
  - Approve, and reject with a reason.

## 7. Build sequence

1. Backend: migration, models, storage seam, endpoints and tests. Every client depends on this API contract.
2. In parallel once the contract is fixed: mobile onboarding (against the mock transport, then the real backend) and the admin app (against the real backend).
3. End-to-end check: an artist submits on the phone, an admin approves on the web, and the phone moves to the artist home on its next refresh.

**Needed from the product owner before step 1 goes live:** a Cloudinary account's cloud name, API key and API secret in `backend/.env`. Development and tests run on `FakeStorage` until then.
