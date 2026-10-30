# Seed Data Images — Design

## Problem

The demo seed (`backend/scripts/seed.py`) creates `PortfolioPhoto` rows with keys like
`seed/henna-by-priya/cover-1.jpg`, but no image files exist in storage, so every
`photo_url` / `cover_url` / `photo_urls` the directory API returns points at a 404. The seed also never
sets `ArtistProfile.photo_key` (avatar) or `ArtistServiceItem.photo_key` (package photo), so those render
empty everywhere in mobile/admin.

The dev/staging backend runs `STORAGE_PROVIDER=r2` (Cloudflare R2, credentials in `backend/.env.dev`;
settings are loaded from `.env`). Local default is `fake` storage, which stores nothing.

## Goal

Seeded artists show real, theme-appropriate imagery in the dev environment (R2-backed), with the seed
script remaining idempotent and harmless in local `fake` mode.

## Chosen approach

Generate a committed seed-asset bundle with an image generator and upload it to the R2 public bucket from
the seed script. (Rejected: stock-photo APIs at seed time — needs API keys + network dependency; absolute
URL passthrough hack in `ImageStorage.url()` — touches production code paths and yields unrelated images.)

## Asset inventory (12 images, committed)

Stored under `backend/scripts/seed-assets/`, mirroring the R2 key layout `seed/<artist-slug>/`:

| Asset | Key | Size | Content |
| --- | --- | --- | --- |
| Artist avatar ×4 | `seed/<slug>/avatar.jpg` | 1024×1024 | Realistic portrait photo matching each persona (Priya — mehendi, Bangalore; Sneha — makeup, Bangalore; Aisha — bridal, Mumbai; Kavitha — hair, Chennai) |
| Portfolio covers ×8 | `seed/<slug>/cover-1.jpg`, `cover-2.jpg` | 1024×1280 (4:5) | Work shots themed to each artist's services (bridal full-hand mehendi, party mehendi, HD bridal makeup, party makeup, blow dry, hair colour) |

- Existing `PortfolioPhoto` keys stay unchanged (`seed/<business-slug>/cover-N.jpg`); the real files now
  exist under those keys. `width/height` on `PortfolioPhoto` stays 1080×1350 (4:5 ratio preserved; exact
  pixel values are metadata only — R2 serves the original).
- Slugs derive from business names as today: `henna-by-priya`, `glam-by-sneha`, `bridal-studio-by-aisha`,
  `kavitha-hair-studio`.

## Database changes in `seed.py`

- `ArtistProfile.photo_key = seed/<slug>/avatar.jpg` for each seeded artist.
- `ArtistServiceItem.photo_key` = one of that artist's `cover-N.jpg` keys (service index picks cover-1 or
  cover-2 deterministically). No extra files — R2 serves the same object under two references.
- Idempotency unchanged: rows are only created when the artist profile doesn't exist. For profiles that
  already exist from a previous seed run, the seed backfills the image fields only when they are currently
  NULL (never overwrites user-set values).

## Upload step (`seed_images()` in `seed.py`)

Runs before artist rows are written:

1. Read `get_upload_settings()`. If `storage_provider != "r2"` → log a skip note and return (fake mode
   still seeds DB rows; URLs won't render, same as any real upload under fake).
2. Reuse the cached `app.upload.service.r2_client(account_id, access_key_id, secret)` helper (boto3,
   already a locked dependency).
3. For each file under `seed-assets/` → key = path relative to `seed-assets/`:
   - `head_object(Bucket=r2_bucket, Key=key)` → skip if present (idempotent, no re-uploads).
   - else `put_object(Bucket=r2_bucket, Key=key, Body=file, ContentType="image/jpeg")`.
4. Any `ClientError`/`BotoCoreError` other than 404-on-head → print the failing key and raise. Seed is a
   dev tool; a loud half-failure beats a silently missing image.

To push assets to dev: activate the R2 env (`cp backend/.env.dev backend/.env`, or otherwise make settings
see R2 config), then `.venv/bin/python -m scripts.seed` from `backend/`.

## Out of scope

- Category/service-template imagery (catalog models have no image fields).
- Admin-panel or mobile UI changes (none needed — they already consume `photo_url`/`cover_url`).
- Any change to `app/upload/`, `app/directory/`, or models.

## Verification

1. Run seed twice with R2 env: no duplicate DB rows, second run uploads nothing new (head_object skips),
   output confirms counts.
2. `curl -I {R2_PUBLIC_URL}/seed/henna-by-priya/cover-1.jpg` → 200, `Content-Type: image/jpeg`.
3. Directory API (`/artists` list + detail) returns non-null `photo_url`, `cover_url`, populated
   `photo_urls[]`, and service `photo_url`s.
4. Run seed once under `fake` storage: skips uploads cleanly, still idempotent.
5. `ruff` / `mypy` clean on `scripts/seed.py` per backend lint config.

## Risks

- ~2-6 MB of JPEGs added to the repo (acceptable for a dev-only seed bundle).
- AI-generated faces are fictional personas — fine for demo data; swap for client-supplied photos before
  any public demo.
- If the R2 bucket is ever emptied, re-running the seed re-uploads everything (self-healing).
