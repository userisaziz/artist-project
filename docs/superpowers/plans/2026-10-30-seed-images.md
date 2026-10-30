# Seed Data Images Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make seeded demo artists show real images (avatar, portfolio covers, service photos) served from the dev R2 bucket, keeping `scripts/seed.py` idempotent and harmless under `fake` storage.

**Architecture:** 12 AI-generated JPEGs are committed under `backend/scripts/seed-assets/` mirroring the R2 key layout `seed/<artist-slug>/`. A new `seed_images()` step in the existing seed script uploads them to the R2 public bucket (skip-if-exists via `head_object`), and the artist seed sets `photo_key` on profiles/service items and backfills NULL fields on already-seeded rows. No app-code changes.

**Tech Stack:** Python 3.14 (`backend/.venv`), SQLAlchemy 2 async, boto3 (already locked at 1.43.120), Cloudflare R2 S3 API, ImageGen + macOS `sips` for asset production.

**Spec:** `docs/superpowers/specs/2026-10-30-seed-images-design.md`

**Testing note:** `backend/scripts/*` has no pytest harness (it mutates the real Neon dev DB and R2 bucket). Verification is by executing the seed and asserting on stdout, R2 HTTP responses, and DB column values — the same convention `make_admin.py` / `maintenance.py` follow.

---

### Task 1: Produce the 12 seed images

**Files:**
- Create: `backend/scripts/seed-assets/seed/henna-by-priya/{avatar.jpg,cover-1.jpg,cover-2.jpg}`
- Create: `backend/scripts/seed-assets/seed/glam-by-sneha/{avatar.jpg,cover-1.jpg,cover-2.jpg}`
- Create: `backend/scripts/seed-assets/seed/bridal-studio-by-aisha/{avatar.jpg,cover-1.jpg,cover-2.jpg}`
- Create: `backend/scripts/seed-assets/seed/kavitha-hair-studio/{avatar.jpg,cover-1.jpg,cover-2.jpg}`

- [ ] **Step 1: Generate 4 avatars (1024×1024) with ImageGen**

Style rules for all four: realistic professional studio headshot photograph, subject facing camera, warm and
credible small-business-owner look. Fictional personas — never reference a real celebrity.

| File (key under `seed-assets/`) | Prompt gist |
| --- | --- |
| `seed/henna-by-priya/avatar.jpg` | Indian woman in her early 30s, Malayali features, warm smile, maroon-and-gold saree blouse, henna-decorated hands folded in front, softly blurred salon interior, natural window light, professional portrait photography |
| `seed/glam-by-sneha/avatar.jpg` | Indian woman around 28, Kannada features, flawless soft-glam makeup, black kurta, blurred makeup station with brushes and ring light behind, professional portrait photography |
| `seed/bridal-studio-by-aisha/avatar.jpg` | Confident Indian woman around 35, elegant Urdu-speaking bridal artist vibe, embroidered dupatta over formal wear, blurred bridal atelier with saree rack behind, professional portrait photography |
| `seed/kavitha-hair-studio/avatar.jpg` | Indian woman in her early 30s, Tamil features, glossy blow-dried hair, holding a round brush and hairdryer, blurred modern salon chair background, professional portrait photography |

- [ ] **Step 2: Generate 8 portfolio covers (1024×1280, 4:5) with ImageGen**

| File | Prompt gist |
| --- | --- |
| `seed/henna-by-priya/cover-1.jpg` | Close-up of a bride's hands covered in dense traditional bridal mehendi up to the elbows, gold bangles, maroon bridal fabric, warm wedding lighting, professional bridal photography |
| `seed/henna-by-priya/cover-2.jpg` | Young Indian woman at a festival with delicate light front-and-back hand mehendi, festive bokeh background, professional photography |
| `seed/glam-by-sneha/cover-1.jpg` | Indian bride with HD airbrush makeup, defined eyes and flawless base, gold jewellery, portrait lighting, professional bridal beauty photography |
| `seed/glam-by-sneha/cover-2.jpg` | Young Indian woman with fresh softeye party glam makeup at an evening event, elegant saree, professional portrait photography |
| `seed/bridal-studio-by-aisha/cover-1.jpg` | South Indian bride in full bridal look — heavy gold jewellery, maang tikka, traditional makeup — seated portrait, warm studio lighting, professional photography |
| `seed/bridal-studio-by-aisha/cover-2.jpg` | Mehendi ceremony scene: bride's henna-decorated hands holding marigold flowers, blurred festive family background, professional photography |
| `seed/kavitha-hair-studio/cover-1.jpg` | Indian woman in a salon chair with voluminous glossy blow-dried hair mid-styling, stylist's round brush visible, bright modern salon, professional photography |
| `seed/kavitha-hair-studio/cover-2.jpg` | Close-up of glossy dark shoulder-length freshly coloured hair with healthy shine, salon setting softly blurred, professional hair beauty photography |

- [ ] **Step 3: Convert outputs to JPEG and place at the exact keys**

ImageGen writes PNG (or JPEG) to a temp path; normalize every file to progressive JPEG (R2 seeds are served
with `ContentType=image/jpeg`, so bytes must actually be JPEG):

```bash
cd /Users/almabetter/artist-project/backend/scripts
mkdir -p seed-assets/seed/{henna-by-priya,glam-by-sneha,bridal-studio-by-aisha,kavitha-hair-studio}
# for each generated file <src> -> its target key <dst>:
sips -s format jpeg -s formatOptions 82 "<src>" --out "seed-assets/<key>.jpg" >/dev/null
```

- [ ] **Step 4: Verify inventory**

```bash
find seed-assets -name '*.jpg' | sort   # expect exactly the 12 paths listed in Files above
du -sh seed-assets                       # sanity: a few MB total
```

If ImageGen output looks unusable for a key (wrong subject, garbled hands — hands are the hard case for
mehendi shots), regenerate that key (up to 2 retries) before continuing; cover-1 of the two mehendi artists
MUST show recognizable henna patterns.

- [ ] **Step 5: Commit**

```bash
cd /Users/almabetter/artist-project
git add backend/scripts/seed-assets
git commit -m "chore(seed): add demo image assets for seeded artists"
```

---

### Task 2: Add `seed_images()` R2 upload step to `seed.py`

**Files:**
- Modify: `backend/scripts/seed.py`

- [ ] **Step 1: Add imports and the upload function**

Add to the import block at the top of `seed.py` (after `import asyncio`):

```python
from pathlib import Path
```

and after the `from app.shared.enums import ...` line:

```python
from app.upload.config import get_upload_settings
from app.upload.service import r2_client
from botocore.exceptions import ClientError
```

Add after `ADMIN_PHONE = "+919800000000"`:

```python
ASSETS_DIR = Path(__file__).resolve().parent / "seed-assets"


def seed_images() -> int:
    """Upload seed-assets/**.jpg to the R2 public bucket under the same key (skip objects that exist).

    Under fake storage nothing can be uploaded, so the step is skipped — the DB rows still get their keys,
    exactly like real uploads behave in fake mode. Returns the number of newly uploaded objects.
    """
    s = get_upload_settings()
    if s.storage_provider != "r2":
        print(f"seed images: skipped (storage_provider={s.storage_provider!r}, need 'r2')")
        return 0
    client = r2_client(s.r2_account_id, s.r2_access_key_id, s.r2_secret_access_key.get_secret_value())
    uploaded = skipped = 0
    for path in sorted(ASSETS_DIR.rglob("*.jpg")):
        key = path.relative_to(ASSETS_DIR).as_posix()
        try:
            client.head_object(Bucket=s.r2_bucket, Key=key)
            skipped += 1
        except ClientError as exc:
            if exc.response["Error"]["Code"] not in ("404", "NoSuchKey"):
                print(f"seed images: head_object({key}) failed: {exc}")
                raise
            client.put_object(Bucket=s.r2_bucket, Key=key, Body=path.read_bytes(), ContentType="image/jpeg")
            uploaded += 1
    print(f"seed images: {uploaded} uploaded, {skipped} already present")
    return uploaded
```

- [ ] **Step 2: Call it from `main()`**

In `main()`, insert as the first statement inside the `async with` block (uploads before rows, so a row can
never reference an object that isn't there yet):

```python
        seed_images()
        cats = await seed_catalog(session)
```

- [ ] **Step 3: Run under local fake storage and verify clean skip**

```bash
cd /Users/almabetter/artist-project/backend
.venv/bin/python -m scripts.seed
```

Expected: first line of output is `seed images: skipped (storage_provider='fake', need 'r2')`, then the
normal "Seeded: catalog ..." line, exit code 0. (Local `.env` has no STORAGE_PROVIDER → defaults to fake;
the Neon DB in `.env` is the dev DB, same rows the app uses.)

- [ ] **Step 4: Lint**

```bash
.venv/bin/ruff check scripts/seed.py && .venv/bin/mypy scripts/seed.py
```

Expected: both clean (mypy config in `mypy.ini` covers `app`; if it reports "no module imported" style noise
for `botocore` that pre-exists elsewhere, note it — otherwise fix any reported error).

- [ ] **Step 5: Commit**

```bash
cd /Users/almabetter/artist-project
git add backend/scripts/seed.py
git commit -m "feat(seed): upload seed image assets to R2 when storage provider is r2"
```

---

### Task 3: Wire image keys into artist rows (new + existing profiles)

**Files:**
- Modify: `backend/scripts/seed.py` (`seed_artists` function, module docstring, final print)

- [ ] **Step 1: Add key helpers**

Directly above `async def seed_artists(...)`:

```python
def _asset_keys(business: str) -> tuple[str, list[str]]:
    slug = business.replace(" ", "-").lower()
    return f"seed/{slug}/avatar.jpg", [f"seed/{slug}/cover-1.jpg", f"seed/{slug}/cover-2.jpg"]
```

- [ ] **Step 2: Backfill existing profiles instead of skipping wholesale**

In `seed_artists`, replace the early-continue block:

```python
        if profile is not None:
            by_phone[phone] = (user, profile)
            continue
```

with:

```python
        if profile is not None:
            avatar_key, cover_keys = _asset_keys(business)
            if profile.photo_key is None:
                profile.photo_key = avatar_key
            services = (
                await session.execute(
                    select(ArtistServiceItem)
                    .where(ArtistServiceItem.artist_id == profile.id)
                    .order_by(ArtistServiceItem.sort_order)
                )
            ).scalars().all()
            for i, s in enumerate(services):
                if s.photo_key is None:
                    s.photo_key = cover_keys[i % len(cover_keys)]
            await session.flush()
            by_phone[phone] = (user, profile)
            continue
```

(Explicit select instead of the `profile.services` relationship to avoid lazy-load on the async session.)

- [ ] **Step 3: Set keys on newly created rows**

Right after `for phone, _first, _last, business, city, locality, lat, lng, status, years, langs in ARTISTS:`,
add:

```python
        avatar_key, cover_keys = _asset_keys(business)
```

In the `ArtistProfile(...)` constructor, add the field (anywhere among the kwargs, e.g. after `bio=...`):

```python
            photo_key=avatar_key,
```

In the `ArtistServiceItem(...)` constructor, add:

```python
                photo_key=cover_keys[order % len(cover_keys)],
```

Leave the two `PortfolioPhoto(...)` constructions' `storage_key` f-strings as-is — they already compute the
same `seed/<slug>/cover-N.jpg` key; optionally refactor to reuse `cover_keys[n]` for a single source of truth:

```python
        session.add(PortfolioPhoto(artist_id=profile.id, storage_key=cover_keys[0], width=1080, height=1350, sort_order=0))
        session.add(PortfolioPhoto(artist_id=profile.id, storage_key=cover_keys[1], width=1080, height=1350, sort_order=1))
```

(match existing formatting; the one-liners above are the semantic target.)

- [ ] **Step 4: Update the module docstring**

Docstring line 5: change "...with services, addons and portfolio photos." to
"...with services, addons and portfolio photos, plus avatar and service photos; image assets are uploaded
to R2 by `seed_images`." The final `print(...)` summary in `main()` stays unchanged — `seed_images()`'s own
output line reports the upload counts.

- [ ] **Step 5: Run twice under fake storage; verify idempotency + backfill in DB**

```bash
cd /Users/almabetter/artist-project/backend
.venv/bin/python -m scripts.seed
.venv/bin/python -m scripts.seed
```

Expected both runs: exit 0, no new row counts. Then verify backfill ran (profiles pre-date this change, so
their `photo_key` was NULL and must now be set):

```bash
.venv/bin/python - <<'EOF'
import asyncio
from sqlalchemy import select
from app.artist.models import ArtistProfile, ArtistServiceItem
from app.core.database import SessionLocal, engine

async def main():
    async with SessionLocal() as s:
        rows = (await s.execute(select(ArtistProfile.business_name, ArtistProfile.photo_key))).all()
        print(rows)
        items = (await s.execute(select(ArtistServiceItem.id, ArtistServiceItem.photo_key))).all()
        print(items)
        assert all(k is not None for _, k in rows), "profile photo_key backfill missing"
        assert all(k is not None for _, k in items), "service photo_key backfill missing"
    await engine.dispose()
    print("OK: all profiles and services carry image keys")

asyncio.run(main())
EOF
```

Expected: `OK: all profiles and services carry image keys`.

- [ ] **Step 6: Lint + commit**

```bash
.venv/bin/ruff check scripts/seed.py && .venv/bin/mypy scripts/seed.py
cd /Users/almabetter/artist-project
git add backend/scripts/seed.py
git commit -m "feat(seed): seed artist avatars, portfolio and service photos"
```

---

### Task 4: Upload to R2 and end-to-end verification (dev environment)

**Files:**
- No source changes — run + verify. Fix and re-run if anything below fails.

- [ ] **Step 1: Activate R2 storage for one run WITHOUT touching `.env`**

OS env vars override `.env` values in pydantic-settings. From `backend/`:

```bash
cd /Users/almabetter/artist-project/backend
export $(grep -E '^(STORAGE_PROVIDER|R2_[A-Z_]+)=' .env.dev | xargs)
.venv/bin/python -m scripts.seed
```

Expected first line: `seed images: 12 uploaded, 0 already present` (second run of this step later shows
`0 uploaded, 12 already present`).

- [ ] **Step 2: Verify objects are publicly served**

`R2_PUBLIC_URL` is exported in step 1; check all 12 keys:

```bash
for slug in henna-by-priya glam-by-sneha bridal-studio-by-aisha kavitha-hair-studio; do
  for f in avatar cover-1 cover-2; do
    code=$(curl -s -o /dev/null -w '%{http_code}' "$R2_PUBLIC_URL/seed/$slug/$f.jpg")
    echo "$slug/$f -> $code"
  done
done
```

Expected: 12 lines, all `200`, and `Content-Type: image/jpeg` on at least one `-I` spot check.

- [ ] **Step 3: Verify the directory API exposes the URLs**

With the local API running against the dev DB (it already is, per project convention — `logs/api.log`; if
not running: `.venv/bin/uvicorn app.main:app --port 8000` in background):

```bash
curl -s "http://127.0.0.1:8000/directory/artists?lat=12.9784&lng=77.6408" | head -c 2000
```

Expected: JSON artist cards with non-null `photo_url` / `cover_url` and non-empty `photo_urls`, each URL
pointing at `$R2_PUBLIC_URL/seed/...`. If the endpoint path or required auth differs, read
`backend/app/directory/router.py` and adjust the call (a customer OTP login is available via seeded numbers,
codes print to console with SMS_PROVIDER=console).

- [ ] **Step 4: Idempotency re-run under R2**

```bash
.venv/bin/python -m scripts.seed
```

Expected: `seed images: 0 uploaded, 12 already present`, normal "Seeded: ..." summary, exit 0.

- [ ] **Step 5: Clean shell state + final commit (if any fixups were needed)**

```bash
unset $(grep -E '^(STORAGE_PROVIDER|R2_[A-Z_]+)=' .env.dev | cut -d= -f1)
```

If Tasks 2–4 required code fixups, commit them: `git add backend/scripts/seed.py && git commit -m "fix(seed): ..."`.

---

## Self-review checklist (run after writing, before handoff)

- [x] Spec coverage: asset bundle (Task 1), r2-gated idempotent upload (Task 2), profile/service/backfill
  keys (Task 3), verification incl. curl + API + double-run (Task 4) — matches spec sections "Asset
  inventory", "Upload step", "Database changes", "Verification".
- [x] No placeholders: every code step shows full code; commands are exact.
- [x] Type consistency: `_asset_keys` returns `(avatar_key, cover_keys)` and both consumers use the same
  unpacking; `seed_images()` return value only used for the printed count.
