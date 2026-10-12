# Increment 3: Artist Verification (Aadhaar) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Artists submit their Aadhaar number and photos of the card's front and back as onboarding step 4. Admins see the photos and a masked number (with a logged Reveal) on the existing review page.

**Architecture:** The backend encrypts the number with Fernet, using a key from `.env`, and keeps only the last 4 digits in plain text. It stores the card photos as Cloudinary *private* images and serves them through 5-minute signed download links, all behind the existing `ImageStorage` seam. Identity data lives in its own `artist_kyc` table, and admin reveals are recorded in `aadhaar_reveals`. Mobile adds an Identity step; admin adds an Identity card.

**Tech Stack:** FastAPI, SQLAlchemy 2 async, Alembic, pytest (real Postgres test DB), `cryptography` (Fernet); Expo/React Native (Part 2); React + Vite + shadcn/ui (Part 3).

**Spec:** `docs/superpowers/specs/2026-10-12-artist-verification-aadhaar-design.md`

**Delivery in parts.** You asked to be kept involved at each stage, so the plan comes in three parts:
- **Part 1 (backend)** is written in full below, and is built (branch `feat/artist-verification`).
- **Part 2 (mobile)** is written in full below, against the backend as built, and is built.
- **Part 3 (admin)** is written in full below, after Part 2 was built, against the backend as built (`GET /admin/artists/{id}` with `kyc`, `POST /admin/artists/{id}/kyc/reveal`) and the admin app as it is.

## Global Constraints

- **Aadhaar validity:**
  - exactly 12 digits;
  - the first digit is not 0 or 1;
  - the Verhoeff checksum passes;
  - spaces are stripped before checking.
- **Invalid number response:** `422 validation_error` with the message `"Invalid Aadhaar number"`.
- **Encryption:** the number is stored with Fernet, using setting `AADHAAR_ENCRYPTION_KEY` (32 url-safe base64 bytes). Startup fails if the key is missing or invalid. `aadhaar_last4` is kept in plain text.
- **Photos:**
  - Upload purpose `"aadhaar"`; keys look like `artists/{user_id}/aadhaar/{hex20}`.
  - Stored as Cloudinary `type=private`.
  - Admin links are private-download URLs that expire after **300 seconds**.
- **`PUT /api/v1/artists/me/kyc`:**
  - Body `{aadhaar_number, front_key, back_key}`; all three fields are required on every call.
  - Checks run in this order:
    1. The profile exists, else `404`.
    2. The profile is editable (`draft`/`rejected`), else `409`.
    3. The number is valid, else `422`.
    4. Both keys are owned by the caller with purpose `aadhaar`, else `422 "Invalid photo key"`.
    5. Front and back differ, else `422`.
  - Upserts the row, deletes replaced private files, and returns `ArtistProfileOut`.
- **Artist responses:** `ArtistProfileOut.kyc` is `{aadhaar_last4} | null`. The artist never receives the number, the keys or any URL.
- **Submit:** the `missing` list adds `"kyc"` after `"portfolio"`.
- **Admin detail:** `AdminArtistDetail.kyc` is `{aadhaar_masked: "•••• •••• 4412", front_url, back_url} | null`, where both URLs are fresh private links.
- **Reveal:** `POST /api/v1/admin/artists/{id}/kyc/reveal`:
  - admin only;
  - `404` when there is no KYC row;
  - inserts an `aadhaar_reveals` row;
  - returns `{aadhaar_number}` with `Cache-Control: no-store`.
- **Domain errors:** use `app.core.exceptions` (`ValidationError`, `NotFoundError`, `ConflictError`) so the response has the `{code, message}` shape. Do not rely on pydantic field constraints for the Aadhaar rules, because those produce FastAPI's `{"detail": …}` shape instead.
- **Commits:** every commit message ends with a blank line and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never `git commit --amend`.
- **Commands:** run from `backend/`. Tests: `.venv/bin/python -m pytest -q` (45 pass before this plan). Lint: `.venv/bin/ruff check .`.
- **Test numbers:** use only generated numbers, never real ones. Valid: `234123412346`, `498765432102`, `567812345678`. Checksum-invalid: `234123412347`.

## Decisions this plan makes

1. The Aadhaar rule checks run in the **service** and raise `ValidationError`, so the error has the `{code, message}` shape. The schema field is just `str` with `max_length=20`.
2. The front/back mismatch message is `"Front and back must be different photos"`.
3. `ArtistProfile.kyc` is a one-to-one relationship (`uselist=False`, `lazy="selectin"`, `cascade="all, delete-orphan"`). A newly created profile sets `kyc=None` explicitly, because async sessions can't lazy-load it after a flush. The existing `services=[]` and `photos=[]` follow the same rule.
4. `ImageStorage.delete` gains `private: bool = False`, and new `private_url(key, expires_in=300)` is abstract. `FakeStorage.private_url` returns `https://fake.storage/private/{key}.jpg?expires_at={unix}`.
5. Tests set a fixed Fernet key in `conftest.py`. Developers generate their own key into `backend/.env`. **A running dev server without the key fails to start on reload. That is intended (spec §1.2).**
6. *(Part 2)* `src/artist/aadhaar.ts` exports `isValidAadhaar(digits)` and `formatAadhaar(digits)`. The mock imports `isValidAadhaar` from it, so the app has one Verhoeff port, pinned by unit tests to the backend's test numbers.
7. *(Part 2)* The Aadhaar field keeps **digits only** in state: `onChangeText` drops non-digits and caps at 12, the field shows `formatAadhaar(digits)` (`maxLength={14}`), and `PUT /kyc` sends the 12 digits without spaces.
8. *(Part 2)* "On file and unchanged" means the on-file view (`profile.kyc && !replacing`). The app can't detect anything finer, because it never gets the number or the photos back. "Replace details" clears the form and has no cancel (spec §2.2 asks for none). After a successful `PUT /kyc`, the screen switches to the on-file view, so if `POST /submit` then fails, the retry only re-submits.
9. *(Part 2)* The number error shows once the field has blurred or Submit was pressed, and the number is invalid (an empty number counts). It is computed at render time, so it clears as soon as the number becomes valid. No effects are involved.
10. *(Part 2)* Card tiles are labelled for tests and screen readers as `Add front of card` / `Uploading front of card` / `Retake front of card` (and the same for `back`). A failed upload or retake restores the tile's previous state and shows the error under the form.
11. *(Part 2)* UI copy uses typographic apostrophes, like the existing screens ("Let’s get started"): "Confirm it’s **you**" and "That doesn’t look like a valid Aadhaar number."
12. *(Part 2)* The mock stores `{last4, front_key, back_key}` per profile and never the full number. It has no storage, so "delete replaced files" has nothing to mirror. The seeded approved artist (`+15550009999`) gets last 4 `2346`.
13. *(Part 2)* The mock's "submit requires `kyc`" rule lands in **M2**, together with the Identity screen. If it landed in M1, the existing integration tests (which submit from Portfolio) would fail between the two tasks.
14. *(Part 2)* Portfolio's Continue has no loading state, because it only navigates now. `busy` still covers Make cover and Remove.
15. *(Part 3)* Reveal is a plain `revealAadhaar(id)` call (exported from `queries.ts` next to the hooks), and its result is kept in the Identity card's `useState`. It is deliberately **not** a `useQuery` (query cache) **nor** a `useMutation`, because the mutation cache keeps `data` for `gcTime` after the page unmounts. The card is rendered with `key={a.id}`, so the number can't carry over if the route param changes to another artist without an unmount.
16. *(Part 3)* The revealed number is shown grouped (`2341 2341 2346`), and the Reveal button then disappears. There is no "Hide", because the spec asks for none: the number goes when the admin leaves the page. A failed reveal shows a toast (the `ApiError` message, like Approve/Reject) and the number stays masked.
17. *(Part 3)* The existing full-size dialog is reused by changing its state from `Photo | null` to `Viewing | null`, where `Viewing = { title, url }`. Portfolio photos pass `{ title: 'Portfolio photo', url: p.full_url }`, and the card sides pass `{ title: 'Aadhaar front' | 'Aadhaar back', url }`. The title stays `sr-only`. The backend gives one private URL per side, so the thumbnail and the dialog use the same URL. The dialog image has no `onError` of its own.
18. *(Part 3)* "Refetch once" is a `useRef` flag per Identity card mount, so front and back failing in the same tick still cause exactly one `artist.refetch()`. Later failures do nothing, so a broken image can't loop. Reloading the page starts over.
19. *(Part 3)* Labels, for tests and screen readers: the card title is `Identity (Aadhaar)`; the images have alt text `Aadhaar front` / `Aadhaar back`, inside buttons labelled `Open Aadhaar front` / `Open Aadhaar back`, with the visible captions `Front` / `Back`. The button reads `Reveal` (`Revealing…` while the call is in flight).
20. *(Part 3)* The tests go in `src/App.test.tsx`, the admin app's only test file, and use its in-memory `fetch` backend. The `artist()` fixture gains `kyc: KYC` by default, so the existing review tests also render the card.

## File structure (Part 1)

| File | Responsibility |
|---|---|
| `requirements.txt` (modify) | add `cryptography>=43` |
| `app/core/config.py` (modify) | `aadhaar_encryption_key` setting plus Fernet validation |
| `app/core/crypto.py` (create) | `encrypt_aadhaar`, `decrypt_aadhaar` |
| `app/utils/aadhaar.py` (create) | `is_valid_aadhaar` (Verhoeff), `mask_aadhaar_last4` |
| `.env.example` (modify) | document the key and how to generate it |
| `tests/conftest.py` (modify) | fixed test key; new tables in `TABLES` |
| `app/services/storage.py` (modify) | `aadhaar` purpose, private upload, `private_url`, private delete |
| `app/schemas/artist.py` (modify) | `UploadRequest` purpose, `KycIn`, `KycOut`, `AdminKycOut`, `profile_out` kyc, `RevealOut` |
| `app/models/artist.py` (modify) | `ArtistKyc`, `AadhaarReveal`, `ArtistProfile.kyc` |
| `alembic/versions/d8e2a6b4c1f9_artist_kyc.py` (create) | migration #5 |
| `app/services/artist_service.py` (modify) | `save_kyc`; submit `missing` adds `kyc`; `kyc=None` on create |
| `app/api/v1/artists.py` (modify) | `PUT /artists/me/kyc` |
| `app/services/admin_artist_service.py` (modify) | `reveal_aadhaar` |
| `app/api/v1/admin.py` (modify) | admin detail `kyc`; reveal route |
| Tests | `tests/test_aadhaar.py` (create), `tests/test_storage.py`, `tests/test_kyc.py` (create), `tests/test_artists.py`, `tests/test_admin.py`, `tests/test_migrations.py` |

---

### Task B1: Verhoeff validation, encryption and the key setting

**Files:**
- Modify: `requirements.txt`, `app/core/config.py`, `.env.example`, `tests/conftest.py`
- Create: `app/core/crypto.py`, `app/utils/aadhaar.py`, `tests/test_aadhaar.py`

**Interfaces:**
- Produces:
  - `is_valid_aadhaar(number: str) -> bool`
  - `mask_aadhaar_last4(last4: str) -> str` (returns `"•••• •••• 4412"`)
  - `encrypt_aadhaar(number: str) -> str`
  - `decrypt_aadhaar(token: str) -> str`
  - setting `get_settings().aadhaar_encryption_key`

- [ ] **Step 1: Add the dependency and install it**

Append to `requirements.txt`:

```
cryptography>=43
```

Run: `.venv/bin/pip install -q "cryptography>=43" && .venv/bin/python -c "import cryptography; print(cryptography.__version__)"`
Expected: a version of 43 or higher is printed.

- [ ] **Step 2: Give tests a fixed key and add a dev key**

In `tests/conftest.py`, directly under the existing `os.environ["FAST2SMS_API_KEY"] = ""` line, add:

```python
# Fixed Fernet key for tests (32 zero bytes, base64) — never used outside the test DB.
os.environ["AADHAAR_ENCRYPTION_KEY"] = "MDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA="
```

Append to `.env.example`:

```
# Encrypts stored Aadhaar numbers (Fernet, 32 url-safe base64 bytes). LOSING IT MAKES STORED NUMBERS UNRECOVERABLE — keep a backup.
# Generate: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
AADHAAR_ENCRYPTION_KEY=
```

Add a generated key to the local `backend/.env` (git-ignored). Check first that it is ignored: `git check-ignore -q .env && echo ignored`. Expected: `ignored`. Then run:

```bash
grep -q '^AADHAAR_ENCRYPTION_KEY=' .env || echo "AADHAAR_ENCRYPTION_KEY=$(.venv/bin/python -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())')" >> .env
```

Never print or commit the key's value.

- [ ] **Step 3: Write the failing tests**

Create `tests/test_aadhaar.py`:

```python
"""Aadhaar number rules (Verhoeff checksum) and at-rest encryption."""

import pytest

from app.core.crypto import decrypt_aadhaar, encrypt_aadhaar
from app.utils.aadhaar import is_valid_aadhaar, mask_aadhaar_last4

VALID = ["234123412346", "498765432102", "567812345678"]  # generated, not real people


@pytest.mark.parametrize("number", VALID)
def test_valid_numbers_pass(number):
    assert is_valid_aadhaar(number)


@pytest.mark.parametrize("number", [
    "234123412347",   # checksum off by one
    "034123412346",   # leading 0
    "134123412346",   # leading 1
    "23412341234",    # 11 digits
    "2341234123460",  # 13 digits
    "2341 2341 2346", # spaces are stripped by the service, not here
    "23412341234a",
    "",
])
def test_invalid_numbers_fail(number):
    assert not is_valid_aadhaar(number)


def test_mask_shows_only_last_four():
    assert mask_aadhaar_last4("4412") == "•••• •••• 4412"


def test_encryption_round_trips_and_hides_the_number():
    token = encrypt_aadhaar("234123412346")
    assert "234123412346" not in token
    assert decrypt_aadhaar(token) == "234123412346"
    assert encrypt_aadhaar("234123412346") != token  # Fernet adds a random IV each time


def test_settings_reject_an_invalid_key(monkeypatch):
    from pydantic import ValidationError as PydanticValidationError

    from app.core.config import Settings

    monkeypatch.setenv("AADHAAR_ENCRYPTION_KEY", "not-a-fernet-key")
    with pytest.raises(PydanticValidationError):
        Settings()
```

- [ ] **Step 4: Run them to confirm they fail**

Run: `.venv/bin/python -m pytest tests/test_aadhaar.py -q`
Expected: collection error, `ModuleNotFoundError: No module named 'app.core.crypto'`.

- [ ] **Step 5: Implement**

In `app/core/config.py`:
- add the import `from pydantic import field_validator`;
- add the field after `cloudinary_api_secret`;
- add the validator method inside `Settings`.

```python
    # Fernet key for stored Aadhaar numbers (required: the app refuses to start without it).
    aadhaar_encryption_key: str

    @field_validator("aadhaar_encryption_key")
    @classmethod
    def _valid_fernet_key(cls, value: str) -> str:
        from cryptography.fernet import Fernet

        Fernet(value.encode())  # raises ValueError unless it is 32 url-safe base64-encoded bytes
        return value
```

Create `app/core/crypto.py`:

```python
"""At-rest encryption for Aadhaar numbers (Fernet: AES-128-CBC + HMAC-SHA256, random IV per token).

The key lives in settings, never in the database; losing it makes stored numbers unrecoverable.
"""

from cryptography.fernet import Fernet

from app.core.config import get_settings


def _fernet() -> Fernet:
    return Fernet(get_settings().aadhaar_encryption_key.encode())


def encrypt_aadhaar(number: str) -> str:
    return _fernet().encrypt(number.encode()).decode()


def decrypt_aadhaar(token: str) -> str:
    return _fernet().decrypt(token.encode()).decode()
```

Create `app/utils/aadhaar.py`:

```python
"""Aadhaar number format: 12 digits, first digit 2-9, last digit a Verhoeff check digit."""

import re

# Verhoeff tables: multiplication (D5 group), permutation, as published by Verhoeff (1969).
_D = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 0, 6, 7, 8, 9, 5], [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
    [3, 4, 0, 1, 2, 8, 9, 5, 6, 7], [4, 0, 1, 2, 3, 9, 5, 6, 7, 8], [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
    [6, 5, 9, 8, 7, 1, 0, 4, 3, 2], [7, 6, 5, 9, 8, 2, 1, 0, 4, 3], [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
    [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
]
_P = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 5, 7, 6, 2, 8, 3, 0, 9, 4], [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
    [8, 9, 1, 6, 0, 4, 3, 5, 2, 7], [9, 4, 5, 3, 1, 2, 6, 8, 7, 0], [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
    [2, 7, 9, 3, 8, 0, 6, 4, 1, 5], [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
]


def is_valid_aadhaar(number: str) -> bool:
    if not re.fullmatch(r"[2-9][0-9]{11}", number):
        return False
    check = 0
    for i, digit in enumerate(reversed(number)):
        check = _D[check][_P[i % 8][int(digit)]]
    return check == 0


def mask_aadhaar_last4(last4: str) -> str:
    return f"•••• •••• {last4}"
```

- [ ] **Step 6: Run the tests and the full suite**

Run: `.venv/bin/python -m pytest tests/test_aadhaar.py -q && .venv/bin/python -m pytest -q && .venv/bin/ruff check .`
Expected: `test_aadhaar.py` passes with 14 tests. The full suite passes with 59 tests. Ruff is clean.

- [ ] **Step 7: Commit**

```bash
git add requirements.txt app/core/config.py app/core/crypto.py app/utils/aadhaar.py .env.example tests/conftest.py tests/test_aadhaar.py
git commit -m "feat(backend): Aadhaar Verhoeff validation and Fernet encryption key

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task B2: Private Aadhaar photos in the storage seam

**Files:**
- Modify: `app/services/storage.py`, `app/schemas/artist.py` (`UploadRequest`)
- Test: `tests/test_storage.py`

**Interfaces:**
- Produces:
  - `Purpose` gains `"aadhaar"`.
  - `ImageStorage.private_url(key: str, expires_in: int = 300) -> str`
  - `ImageStorage.delete(key: str, private: bool = False) -> None`
  - `POST /uploads/signature {purpose: "aadhaar"}` works for artists.

- [ ] **Step 1: Write the failing tests**

Append to `tests/test_storage.py` (if ruff flags the mid-file imports, move them to the top):

```python
import time
from urllib.parse import parse_qs, urlparse


def test_aadhaar_upload_is_private_and_signed():
    storage = CloudinaryStorage("demo", "key", "secret")
    owner = uuid.uuid4()
    form = storage.upload_params(owner, "aadhaar")
    assert form["key"].startswith(f"artists/{owner}/aadhaar/")
    assert form["fields"]["type"] == "private"
    signed = {k: form["fields"][k] for k in ("public_id", "timestamp", "allowed_formats", "type")}
    assert form["fields"]["signature"] == storage.sign(signed)
    # other purposes stay public
    assert "type" not in storage.upload_params(owner, "portfolio")["fields"]


def test_cloudinary_private_url_is_a_signed_expiring_download():
    storage = CloudinaryStorage("demo", "key", "secret")
    before = int(time.time())
    url = urlparse(storage.private_url("artists/x/aadhaar/abc", expires_in=300))
    assert (url.scheme, url.netloc, url.path) == ("https", "api.cloudinary.com", "/v1_1/demo/image/download")
    q = {k: v[0] for k, v in parse_qs(url.query).items()}
    assert q["public_id"] == "artists/x/aadhaar/abc"
    assert q["type"] == "private"
    assert q["format"] == "jpg"
    assert q["api_key"] == "key"
    assert before + 300 <= int(q["expires_at"]) <= int(time.time()) + 300
    signed = {k: q[k] for k in ("public_id", "format", "type", "timestamp", "expires_at")}
    assert q["signature"] == storage.sign(signed)


def test_fake_storage_private_url_and_owns_aadhaar():
    storage, owner = FakeStorage(), uuid.uuid4()
    key = storage.upload_params(owner, "aadhaar")["key"]
    assert storage.owns(key, owner, "aadhaar")
    assert not storage.owns(key, owner, "portfolio")
    assert storage.private_url(key).startswith(f"https://fake.storage/private/{key}.jpg?expires_at=")
```

- [ ] **Step 2: Run them to confirm they fail**

Run: `.venv/bin/python -m pytest tests/test_storage.py -q`
Expected: the three new tests FAIL (`KeyError: 'type'` / `AttributeError: … 'private_url'`).

- [ ] **Step 3: Implement**

In `app/services/storage.py`:

1. Add an import, change the purpose type, and add a constant:

```python
from urllib.parse import urlencode
```

```python
Purpose = Literal["artist_photo", "portfolio", "aadhaar"]
PRIVATE_PURPOSES = {"aadhaar"}  # stored without a public URL; viewed through expiring signed links
```

2. In `ImageStorage`, replace the abstract `delete` and add `private_url`:

```python
    @abstractmethod
    def private_url(self, key: str, expires_in: int = 300) -> str:
        """Short-lived link to a private image (admin viewing of identity documents)."""

    @abstractmethod
    async def delete(self, key: str, private: bool = False) -> None:
        """Best effort: a failed delete is logged, never raised (the DB row is already gone)."""
```

3. In `FakeStorage`, add `private_url` and update the `delete` signature:

```python
    def private_url(self, key: str, expires_in: int = 300) -> str:
        return f"https://fake.storage/private/{key}.jpg?expires_at={int(time.time()) + expires_in}"

    async def delete(self, key: str, private: bool = False) -> None:
        FakeStorage.deleted.append(key)
```

4. In `CloudinaryStorage`:
   - In `upload_params`, right after the `signed = {...}` line and before the signature is computed, add:

     ```python
             if purpose in PRIVATE_PURPOSES:
                 signed["type"] = "private"  # part of the signature, so a client can't upload it publicly
     ```

     (The returned `fields` already spread `signed`, so `type` is included.)
   - Add `private_url`.
   - Change `delete` to accept `private`. Keep its existing `try`/`except` POST to `image/destroy` exactly as it is; only the building of `signed` at the top changes.

```python
    def private_url(self, key: str, expires_in: int = 300) -> str:
        # Cloudinary "download" endpoint for private assets (the SDK's private_download_url).
        now = int(time.time())
        params = {"public_id": key, "format": "jpg", "type": "private",
                  "timestamp": str(now), "expires_at": str(now + expires_in)}
        query = urlencode({**params, "api_key": self.api_key, "signature": self.sign(params)})
        return f"https://api.cloudinary.com/v1_1/{self.cloud_name}/image/download?{query}"

    async def delete(self, key: str, private: bool = False) -> None:
        signed = {"public_id": key, "timestamp": str(int(time.time()))}
        if private:
            signed["type"] = "private"
        # (existing try/except POST to image/destroy continues here, unchanged)
```

In `app/schemas/artist.py`, change `UploadRequest`:

```python
class UploadRequest(BaseModel):
    purpose: Literal["artist_photo", "portfolio", "aadhaar"]
```

- [ ] **Step 4: Run tests**

Run: `.venv/bin/python -m pytest -q && .venv/bin/ruff check .`
Expected: all pass (62); ruff clean.

- [ ] **Step 5: Commit**

```bash
git add app/services/storage.py app/schemas/artist.py tests/test_storage.py
git commit -m "feat(backend): private aadhaar uploads with expiring signed download links

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task B3: `artist_kyc` table and `PUT /artists/me/kyc`

**Files:**
- Modify: `app/models/artist.py`, `app/schemas/artist.py`, `app/services/artist_service.py`, `app/api/v1/artists.py`, `tests/conftest.py` (`TABLES`), `tests/test_migrations.py`, `tests/test_artists.py`
- Create: `alembic/versions/d8e2a6b4c1f9_artist_kyc.py`, `tests/test_kyc.py`

**Interfaces:**
- Consumes: `is_valid_aadhaar` and `encrypt_aadhaar` (B1); `storage.owns(key, user_id, "aadhaar")` and `storage.delete(key, private=True)` (B2).
- Produces:
  - models `ArtistKyc`, `AadhaarReveal`, `ArtistProfile.kyc`;
  - schemas `KycIn`, `KycOut`;
  - `ArtistProfileOut.kyc`;
  - `ArtistService.save_kyc(user, body) -> ArtistProfile`;
  - test helpers `add_kyc(client, headers)` and `complete_profile(..., kyc=True)` in `tests/test_artists.py`.

- [ ] **Step 1: Write the failing tests**

Create `tests/test_kyc.py`:

```python
"""Artist identity step: Aadhaar number (encrypted) and card photos (private storage)."""

from sqlalchemy import text

from app.core.crypto import decrypt_aadhaar
from app.services.storage import FakeStorage
from tests.test_artists import complete_profile, sign_in, upload_key

PHONE = "+919845055501"


async def kyc_body(client, headers, number="234123412346") -> dict:
    return {
        "aadhaar_number": number,
        "front_key": await upload_key(client, headers, "aadhaar"),
        "back_key": await upload_key(client, headers, "aadhaar"),
    }


async def test_save_kyc_encrypts_and_returns_only_last4(client, engine):
    headers = await sign_in(client, PHONE)
    await complete_profile(client, headers, kyc=False)
    response = await client.put("/api/v1/artists/me/kyc", headers=headers, json=await kyc_body(client, headers, "2341 2341 2346"))
    assert response.status_code == 200
    body = response.json()
    assert body["kyc"] == {"aadhaar_last4": "2346"}
    assert "234123412346" not in response.text and "aadhaar/" not in response.text  # no number, no keys, no URLs
    async with engine.connect() as conn:
        row = (await conn.execute(text("SELECT aadhaar_encrypted, aadhaar_last4 FROM artist_kyc"))).one()
    assert row.aadhaar_last4 == "2346"
    assert "234123412346" not in row.aadhaar_encrypted
    assert decrypt_aadhaar(row.aadhaar_encrypted) == "234123412346"
    me = (await client.get("/api/v1/artists/me", headers=headers)).json()
    assert me["kyc"] == {"aadhaar_last4": "2346"}


async def test_kyc_rejects_bad_numbers_and_keys(client):
    headers = await sign_in(client, PHONE)
    await complete_profile(client, headers, kyc=False)
    bad = await client.put("/api/v1/artists/me/kyc", headers=headers, json=await kyc_body(client, headers, "234123412347"))
    assert bad.status_code == 422
    assert bad.json() == {"code": "validation_error", "message": "Invalid Aadhaar number"}

    other = await sign_in(client, "+919845055502")
    foreign = await upload_key(client, other, "aadhaar")
    body = await kyc_body(client, headers)
    response = await client.put("/api/v1/artists/me/kyc", headers=headers, json={**body, "front_key": foreign})
    assert response.status_code == 422 and response.json()["message"] == "Invalid photo key"

    wrong_purpose = await upload_key(client, headers, "portfolio")
    response = await client.put("/api/v1/artists/me/kyc", headers=headers, json={**body, "back_key": wrong_purpose})
    assert response.status_code == 422 and response.json()["message"] == "Invalid photo key"

    same = await client.put("/api/v1/artists/me/kyc", headers=headers, json={**body, "back_key": body["front_key"]})
    assert same.status_code == 422 and same.json()["message"] == "Front and back must be different photos"


async def test_kyc_needs_a_profile_and_an_editable_one(client):
    headers = await sign_in(client, PHONE)
    no_profile = await client.put("/api/v1/artists/me/kyc", headers=headers, json=await kyc_body(client, headers))
    assert no_profile.status_code == 404

    await complete_profile(client, headers)  # includes kyc
    assert (await client.post("/api/v1/artists/me/submit", headers=headers)).status_code == 200
    locked = await client.put("/api/v1/artists/me/kyc", headers=headers, json=await kyc_body(client, headers))
    assert locked.status_code == 409


async def test_replacing_kyc_deletes_old_private_files(client):
    headers = await sign_in(client, PHONE)
    await complete_profile(client, headers, kyc=False)
    first = await kyc_body(client, headers)
    await client.put("/api/v1/artists/me/kyc", headers=headers, json=first)
    FakeStorage.deleted.clear()
    second = await kyc_body(client, headers, "498765432102")
    response = await client.put("/api/v1/artists/me/kyc", headers=headers, json=second)
    assert response.json()["kyc"] == {"aadhaar_last4": "2102"}
    assert set(FakeStorage.deleted) == {first["front_key"], first["back_key"]}


async def test_submit_requires_kyc(client):
    headers = await sign_in(client, PHONE)
    await complete_profile(client, headers, kyc=False)
    response = await client.post("/api/v1/artists/me/submit", headers=headers)
    assert response.status_code == 422
    assert response.json()["missing"] == ["kyc"]


async def test_aadhaar_upload_ticket_is_artist_only(client):
    headers = await sign_in(client, "+919845055503", role="customer")
    response = await client.post("/api/v1/uploads/signature", headers=headers, json={"purpose": "aadhaar"})
    assert response.status_code == 403
```

In `tests/test_artists.py`:

1. Add a helper right after `upload_key`:

```python
async def add_kyc(client, headers) -> None:
    """Identity step with a generated (not real) Aadhaar number."""
    response = await client.put("/api/v1/artists/me/kyc", headers=headers, json={
        "aadhaar_number": "234123412346",
        "front_key": await upload_key(client, headers, "aadhaar"),
        "back_key": await upload_key(client, headers, "aadhaar"),
    })
    assert response.status_code == 200
```

2. Change `complete_profile`'s signature to `async def complete_profile(client, headers, photos: int = 6, kyc: bool = True) -> dict:`, and add this before its final `return`:

```python
    if kyc:
        await add_kyc(client, headers)
```

3. In `test_submit_lists_what_is_missing`, change the expected list to `["photo", "services", "portfolio", "kyc"]`.

In `tests/test_migrations.py`, add `"artist_kyc", "aadhaar_reveals"` to `EXPECTED_TABLES`.

In `tests/conftest.py`, change `TABLES` to:

```python
TABLES = "users, user_roles, otp_codes, refresh_tokens, artist_profiles, artist_categories, artist_services, portfolio_photos, categories, artist_kyc, aadhaar_reveals"
```

- [ ] **Step 2: Run them to confirm they fail**

Run: `.venv/bin/python -m pytest tests/test_kyc.py tests/test_migrations.py -q`
Expected: FAIL. The cleanup `TRUNCATE` errors with `relation "artist_kyc" does not exist`, the migration test lacks the tables, and `/artists/me/kyc` returns 404/405.

- [ ] **Step 3: Migration**

Confirm the head first: `.venv/bin/alembic heads`. Expected: `c4d1f7a9b2e3 (head)`.

Create `alembic/versions/d8e2a6b4c1f9_artist_kyc.py`:

```python
"""artist_kyc and aadhaar_reveals (migration #5: Aadhaar verification)

Revision ID: d8e2a6b4c1f9
Revises: c4d1f7a9b2e3
Create Date: 2026-10-12
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'd8e2a6b4c1f9'
down_revision: Union[str, Sequence[str], None] = 'c4d1f7a9b2e3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'artist_kyc',
        sa.Column('artist_id', sa.UUID(), sa.ForeignKey('artist_profiles.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('aadhaar_encrypted', sa.Text(), nullable=False),
        sa.Column('aadhaar_last4', sa.String(4), nullable=False),
        sa.Column('front_key', sa.String(255), nullable=False),
        sa.Column('back_key', sa.String(255), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_table(
        'aadhaar_reveals',
        sa.Column('id', sa.UUID(), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('artist_id', sa.UUID(), sa.ForeignKey('artist_profiles.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('admin_id', sa.UUID(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('revealed_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )


def downgrade() -> None:
    op.drop_table('aadhaar_reveals')
    op.drop_table('artist_kyc')
```

- [ ] **Step 4: Models**

Append to `app/models/artist.py` (it already imports `sa`, `DateTime`, `ForeignKey`, `String`, `Text`, `func`, `UUID`, `Mapped`, `mapped_column`, `relationship`, `Base`, `TimestampMixin`, `uuid`, `datetime`):

```python
class ArtistKyc(Base, TimestampMixin):
    """Identity proof for one artist profile. The Aadhaar number is Fernet-encrypted; only the last 4 are plain."""

    __tablename__ = "artist_kyc"
    __mapper_args__ = {"eager_defaults": True}

    artist_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("artist_profiles.id", ondelete="CASCADE"), primary_key=True
    )
    aadhaar_encrypted: Mapped[str] = mapped_column(Text, nullable=False)
    aadhaar_last4: Mapped[str] = mapped_column(String(4), nullable=False)
    front_key: Mapped[str] = mapped_column(String(255), nullable=False)  # private storage keys
    back_key: Mapped[str] = mapped_column(String(255), nullable=False)


class AadhaarReveal(Base):
    """Audit trail: which admin decrypted which artist's Aadhaar number, and when."""

    __tablename__ = "aadhaar_reveals"
    __mapper_args__ = {"eager_defaults": True}

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
    )
    artist_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("artist_profiles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    admin_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    revealed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
```

In `ArtistProfile`, after `photos`, add:

```python
    kyc: Mapped["ArtistKyc | None"] = relationship(lazy="selectin", uselist=False, cascade="all, delete-orphan")
```

- [ ] **Step 5: Schemas**

In `app/schemas/artist.py`, add these after `PhotoOrder`:

```python
class KycIn(BaseModel):
    # Format and checksum are checked in the service so errors keep the {code, message} contract.
    aadhaar_number: str = Field(max_length=20)
    front_key: str = Field(min_length=1, max_length=255)
    back_key: str = Field(min_length=1, max_length=255)


class KycOut(BaseModel):
    """What the artist sees about their own identity proof: never the number, keys or images."""

    aadhaar_last4: str
```

Add the field to `ArtistProfileOut`, after `photos`:

```python
    kyc: KycOut | None
```

In `profile_out`, add the argument after `photos=…`:

```python
        kyc=KycOut(aadhaar_last4=profile.kyc.aadhaar_last4) if profile.kyc else None,
```

- [ ] **Step 6: Service and route**

In `app/services/artist_service.py`:
- add the imports `from app.core.crypto import encrypt_aadhaar` and `from app.utils.aadhaar import is_valid_aadhaar`;
- add `ArtistKyc` to the `app.models.artist` import;
- add `KycIn` to the `app.schemas.artist` import.

In `save_profile`, change the new-profile constructor to also set `kyc=None`:

```python
            profile = ArtistProfile(user_id=user.id, business_name=body.business_name, city=body.city, services=[], photos=[], kyc=None)
```

Add this method after `reorder_photos`:

```python
    async def save_kyc(self, user: User, body: KycIn) -> ArtistProfile:
        """Identity step: validate, encrypt, store; a replacement deletes the superseded private files."""
        profile = await self._editable(user)
        number = body.aadhaar_number.replace(" ", "")
        if not is_valid_aadhaar(number):
            raise ValidationError("Invalid Aadhaar number")
        for key in (body.front_key, body.back_key):
            if not self.storage.owns(key, user.id, "aadhaar"):
                raise ValidationError("Invalid photo key")
        if body.front_key == body.back_key:
            raise ValidationError("Front and back must be different photos")

        fields = {"aadhaar_encrypted": encrypt_aadhaar(number), "aadhaar_last4": number[-4:],
                  "front_key": body.front_key, "back_key": body.back_key}
        stale: list[str] = []
        if profile.kyc is None:
            profile.kyc = ArtistKyc(**fields)
        else:
            kept = {body.front_key, body.back_key}
            stale = [k for k in (profile.kyc.front_key, profile.kyc.back_key) if k not in kept]
            for name, value in fields.items():
                setattr(profile.kyc, name, value)
        await self.session.flush()
        for key in stale:
            await self.storage.delete(key, private=True)
        return profile
```

In `submit`, after the `portfolio` check, add:

```python
        if profile.kyc is None:
            missing.append("kyc")
```

In `app/api/v1/artists.py`, add `KycIn` to the schema import and add the route after `reorder_photos`:

```python
@router.put("/kyc", response_model=ArtistProfileOut)
async def save_kyc(
    body: KycIn, user: User = Depends(current_artist), service: ArtistService = Depends(get_artist_service)
) -> ArtistProfileOut:
    return profile_out(await service.save_kyc(user, body), service.storage)
```

- [ ] **Step 7: Run tests**

Run: `.venv/bin/python -m pytest -q && .venv/bin/ruff check .`
Expected: all tests pass, including the 6 new KYC tests and the existing artist and admin tests, which now include KYC through `complete_profile`. Ruff is clean.

Admin detail responses will include the artist-shaped `kyc` field for now; Task B4 replaces that shape. Only fix assertions here that broke because of B3 itself.

- [ ] **Step 8: Commit**

```bash
git add alembic/versions/d8e2a6b4c1f9_artist_kyc.py app/models/artist.py app/schemas/artist.py app/services/artist_service.py app/api/v1/artists.py tests/conftest.py tests/test_migrations.py tests/test_artists.py tests/test_kyc.py
git commit -m "feat(backend): artist_kyc table and PUT /artists/me/kyc; submit requires kyc

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task B4: Admin view of the Aadhaar details, and the logged reveal

**Files:**
- Modify: `app/schemas/artist.py`, `app/services/admin_artist_service.py`, `app/api/v1/admin.py`
- Test: `tests/test_admin.py`

**Interfaces:**
- Consumes: `ArtistKyc` and `AadhaarReveal` (B3); `decrypt_aadhaar` and `mask_aadhaar_last4` (B1); `storage.private_url` (B2); `complete_profile` (B3, adds KYC by default).
- Produces:
  - `AdminKycOut {aadhaar_masked, front_url, back_url}`;
  - `AdminArtistDetail.kyc: AdminKycOut | None`;
  - `RevealOut {aadhaar_number}`;
  - `admin_kyc_out(kyc, storage)`;
  - `AdminArtistService.reveal_aadhaar(admin, artist_id) -> str`;
  - route `POST /admin/artists/{artist_id}/kyc/reveal`.

- [ ] **Step 1: Write the failing tests**

Add `from sqlalchemy import text as sql_text` to the imports at the top of `tests/test_admin.py`, then append:

```python
# --- Aadhaar verification ---------------------------------------------------

async def submitted_artist(client, phone="+919845066601") -> str:
    headers = await sign_in(client, phone, role="artist")
    await complete_profile(client, headers)
    assert (await client.post("/api/v1/artists/me/submit", headers=headers)).status_code == 200
    return (await client.get("/api/v1/artists/me", headers=headers)).json()["id"]


async def test_admin_detail_shows_masked_aadhaar_and_private_links(client, engine):
    await seed_categories(engine)
    artist_id = await submitted_artist(client)
    headers = await admin(client, engine)
    kyc = (await client.get(f"/api/v1/admin/artists/{artist_id}", headers=headers)).json()["kyc"]
    assert kyc["aadhaar_masked"] == "•••• •••• 2346"
    assert kyc["front_url"].startswith("https://fake.storage/private/") and "/aadhaar/" in kyc["front_url"]
    assert kyc["back_url"].startswith("https://fake.storage/private/")
    assert kyc["front_url"] != kyc["back_url"]
    assert "234123412346" not in str(kyc)


async def test_reveal_returns_the_number_and_logs_it(client, engine):
    await seed_categories(engine)
    artist_id = await submitted_artist(client)
    headers = await admin(client, engine)
    response = await client.post(f"/api/v1/admin/artists/{artist_id}/kyc/reveal", headers=headers)
    assert response.status_code == 200
    assert response.json() == {"aadhaar_number": "234123412346"}
    assert response.headers["cache-control"] == "no-store"
    async with engine.connect() as conn:
        rows = (await conn.execute(sql_text(
            "SELECT r.artist_id::text, u.phone FROM aadhaar_reveals r JOIN users u ON u.id = r.admin_id"
        ))).all()
    assert [(r[0], r[1]) for r in rows] == [(artist_id, ADMIN_PHONE)]


async def test_reveal_is_admin_only_and_needs_kyc(client, engine):
    await seed_categories(engine)
    artist_id = await submitted_artist(client)
    artist_headers = await sign_in(client, "+919845066602", role="artist")
    forbidden = await client.post(f"/api/v1/admin/artists/{artist_id}/kyc/reveal", headers=artist_headers)
    assert forbidden.status_code == 403

    headers = await admin(client, engine)
    async with engine.begin() as conn:
        await conn.execute(sql_text("DELETE FROM artist_kyc"))  # a profile submitted before this increment
    detail = (await client.get(f"/api/v1/admin/artists/{artist_id}", headers=headers)).json()
    assert detail["kyc"] is None
    missing = await client.post(f"/api/v1/admin/artists/{artist_id}/kyc/reveal", headers=headers)
    assert missing.status_code == 404
```

(Check whether `test_admin.py`'s other tests call `seed_categories(engine)` before `complete_profile`, as `test_category_in_use_cannot_be_deleted` does. If categories are already seeded by an autouse fixture imported from `test_artists`, remove the `await seed_categories(engine)` lines above so the unique constraint doesn't fire.)

- [ ] **Step 2: Run them to confirm they fail**

Run: `.venv/bin/python -m pytest tests/test_admin.py -q`
Expected: the new tests FAIL. Either `kyc` has the artist shape (no `aadhaar_masked`), or the reveal returns 404/405.

- [ ] **Step 3: Implement**

In `app/schemas/artist.py`:
- add `ArtistKyc` to the `app.models.artist` import;
- add `from app.utils.aadhaar import mask_aadhaar_last4`;
- add the following after `ArtistOwner`, and **replace** `AdminArtistDetail`:

```python
class AdminKycOut(BaseModel):
    aadhaar_masked: str
    front_url: str  # private, expiring (300 s)
    back_url: str


class AdminArtistDetail(ArtistProfileOut):
    owner: ArtistOwner
    kyc: AdminKycOut | None  # admin shape replaces the artist's {aadhaar_last4}


class RevealOut(BaseModel):
    aadhaar_number: str


def admin_kyc_out(kyc: ArtistKyc | None, storage: ImageStorage) -> AdminKycOut | None:
    if kyc is None:
        return None
    return AdminKycOut(
        aadhaar_masked=mask_aadhaar_last4(kyc.aadhaar_last4),
        front_url=storage.private_url(kyc.front_key),
        back_url=storage.private_url(kyc.back_key),
    )
```

In `app/services/admin_artist_service.py`:
- add `from app.core.crypto import decrypt_aadhaar`;
- add `AadhaarReveal` to the `app.models.artist` import (create the import if it's missing);
- make sure `NotFoundError` is imported from `app.core.exceptions`;
- add this method after `reject`:

```python
    async def reveal_aadhaar(self, admin: User, artist_id: uuid.UUID) -> str:
        """Decrypt one artist's Aadhaar number for an admin, leaving an audit row."""
        profile, _owner = await self.get(artist_id)
        if profile.kyc is None:
            raise NotFoundError("No Aadhaar on file")
        self.session.add(AadhaarReveal(artist_id=profile.id, admin_id=admin.id))
        await self.session.flush()
        return decrypt_aadhaar(profile.kyc.aadhaar_encrypted)
```

In `app/api/v1/admin.py`:
- extend the schema import with `RevealOut, admin_kyc_out`;
- add `Response` to the `fastapi` import;
- replace `_detail`;
- add the route at the end of the file.

```python
def _detail(profile: ArtistProfile, owner: User, storage: ImageStorage) -> AdminArtistDetail:
    data = profile_out(profile, storage).model_dump(exclude={"kyc"})
    return AdminArtistDetail(**data, owner=ArtistOwner.model_validate(owner), kyc=admin_kyc_out(profile.kyc, storage))
```

```python
@router.post("/{artist_id}/kyc/reveal", response_model=RevealOut)
async def reveal_aadhaar(
    artist_id: uuid.UUID,
    response: Response,
    admin: User = Depends(current_admin),
    service: AdminArtistService = Depends(get_admin_artist_service),
) -> RevealOut:
    response.headers["Cache-Control"] = "no-store"  # never let a proxy or browser keep the full number
    return RevealOut(aadhaar_number=await service.reveal_aadhaar(admin, artist_id))
```

- [ ] **Step 4: Run tests**

Run: `.venv/bin/python -m pytest -q && .venv/bin/ruff check .`
Expected: all pass; ruff clean.

- [ ] **Step 5: Apply the migration to the dev database**

Run: `.venv/bin/alembic upgrade head`
Expected: `Running upgrade c4d1f7a9b2e3 -> d8e2a6b4c1f9`.

- [ ] **Step 6: Commit**

```bash
git add app/schemas/artist.py app/services/admin_artist_service.py app/api/v1/admin.py tests/test_admin.py
git commit -m "feat(backend): admin sees masked Aadhaar and private card links; logged reveal

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Part 2 (mobile)

Implements spec §2 exactly, against the backend as built: `PUT /api/v1/artists/me/kyc`, `KycIn {aadhaar_number, front_key, back_key}`, `ArtistProfileOut.kyc: {aadhaar_last4} | null`, and `missing` gaining `"kyc"` after `"portfolio"`.

### Global Constraints (Part 2)

- **Commands:** run from `mobile/`.
  - Tests: `npx jest` (83 pass before Part 2; 87 after M1; 90 after M2).
  - Types: `npx tsc --noEmit`.
  - Lint: `npx expo lint`.
  - Tests run with `EXPO_PUBLIC_USE_MOCKS=true`, so every integration test runs against `MockTransport`.
- **The mock mirrors the backend contract**, with these exact strings and order:
  - `PUT /artists/me/kyc` checks, in order:
    1. the profile exists (`404 not_found`);
    2. it is editable (`409 conflict`);
    3. the number is valid after spaces are removed (`422 "Invalid Aadhaar number"`);
    4. both keys are the caller's `aadhaar` keys (`422 "Invalid photo key"`);
    5. front and back differ (`422 "Front and back must be different photos"`).
  - The response is the profile, with `kyc: {aadhaar_last4}`.
  - In submit's `missing` list, `"kyc"` comes after `"portfolio"`.
- **The full number never leaves the Identity screen's component state.** It is not logged, not put in the query cache (the server answers with `last4` only), and not persisted. Cloudinary's `type=private` is already a signed field in the upload ticket, so `postToStorage` needs no change.
- **Lint:**
  - no `setState` inside `useEffect` (`react-hooks/set-state-in-effect`): reset during render or in event handlers;
  - no unused imports.
- **Handlers guard themselves.** Under RNTL, `fireEvent.press` on a disabled `AppButton` can still reach `onPress`, so every Continue/Submit handler re-checks its own preconditions.
- **Integration tests:**
  - Use a fresh phone number per test; signing in twice as the same phone in one file hangs. New numbers: `9845044450`, `9845044451`, `9845044452`. The `98450444xx` numbers already in use are `41`–`49`.
  - `jest.mock` factories may only reference variables prefixed `mock`.
  - `await screen.unmount()`.
  - `queryClient` is a shared singleton: restore changed defaults, and every `jest.spyOn(transport, 'request')`, in `finally`.
- **Test Aadhaar numbers** are generated only:
  - valid: `234123412346` (last 4 `2346`), `498765432102` (`2102`), `567812345678`;
  - checksum-invalid: `234123412347`.
- **Copy (exact):**
  - Intro: "4 short steps".
  - Identity eyebrow and title: "STEP 4 · IDENTITY", then "Confirm it’s **you**".
  - Identity subtitle: "We use your Aadhaar only to verify your identity."
  - Number error: "That doesn’t look like a valid Aadhaar number."
  - Privacy note: "Your Aadhaar is encrypted and only seen by our verification team."
  - On-file line and link: "Aadhaar on file •••• NNNN" with "Replace details".
  - Button: "Submit for review".
  - In review middle milestone: "Identity & portfolio check".
- **Commits:** every commit message ends with a blank line and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never `git commit --amend`.

### File structure (Part 2)

| File | Responsibility |
|---|---|
| `src/api/types.ts` (modify) | `ArtistProfile.kyc`, `UploadPurpose` adds `'aadhaar'`, `KycInput` |
| `src/api/endpoints/artist.ts` (modify) | `saveKyc(body)` → `PUT /artists/me/kyc` |
| `src/artist/aadhaar.ts` (create) | `isValidAadhaar` (Verhoeff, same tables as the backend), `formatAadhaar` |
| `src/api/mock/artist.ts` (modify) | `aadhaar` purpose, `PUT /artists/me/kyc`, `kyc` in the profile, seeded kyc; in M2, `kyc` in `missing` |
| `src/artist/routing.ts` (modify) | `ResumeStep` adds `'identity'`; the new resume rule |
| `app/artist/onboarding/identity.tsx` (create) | step 4 of 4: number, front/back tiles, on-file / Replace details, Submit for review |
| `app/artist/onboarding/{profile,services,portfolio}.tsx` (modify) | `steps={4}`; Portfolio's Continue pushes Identity, and submit moves off it |
| `app/artist/onboarding/{intro,_layout}.tsx`, `app/artist/in-review.tsx` (modify) | "4 short steps"; the flow comment; "Identity & portfolio check" |
| `README.md` (modify) | the mock-mode onboarding walkthrough includes Identity |
| Tests | `src/artist/__tests__/aadhaar.test.ts` (create), `src/api/__tests__/mock-artist.test.ts`, `src/artist/__tests__/routing.test.ts`, `src/__tests__/artist-onboarding.test.tsx` |

`src/__tests__/auth-flow.test.tsx` needs **no change**. Its `Step 1 of 3` and `Step 3 of 3` checks are the *auth* progress bar (`FormScreen`'s `AUTH_STEPS = 3`: Log in → Verify → Your details), and it never reaches Portfolio. Its seeded-artist test only checks the artist home. Step 9 of M2 confirms this with a grep.

---

### Task M1: Aadhaar types, Verhoeff check, `saveKyc`, and the mock `PUT /artists/me/kyc`

**Files:**
- Modify: `src/api/types.ts`, `src/api/endpoints/artist.ts`, `src/api/mock/artist.ts`, `src/artist/__tests__/routing.test.ts` (fixture only)
- Create: `src/artist/aadhaar.ts`, `src/artist/__tests__/aadhaar.test.ts`
- Test: `src/api/__tests__/mock-artist.test.ts`

**Interfaces:**
- Consumes: the backend contract (B3): `PUT /artists/me/kyc`, `KycIn`, `ArtistProfileOut.kyc`.
- Produces:
  - `ArtistProfile.kyc: { aadhaar_last4: string } | null`
  - `UploadPurpose = 'artist_photo' | 'portfolio' | 'aadhaar'`
  - `KycInput { aadhaar_number; front_key; back_key }`
  - `saveKyc(body: KycInput): Promise<ArtistProfile>`
  - `isValidAadhaar(digits: string): boolean`
  - `formatAadhaar(digits: string): string`
  - the mock route `PUT /artists/me/kyc` and the seeded artist's kyc.

- [ ] **Step 1: Write the failing tests**

Create `src/artist/__tests__/aadhaar.test.ts`:

```ts
import { formatAadhaar, isValidAadhaar } from '../aadhaar';

// Generated numbers (not real people): the same ones the backend tests use (tests/test_aadhaar.py).
const VALID = ['234123412346', '498765432102', '567812345678'];
const INVALID = [
  '234123412347',   // checksum off by one
  '034123412346',   // leading 0
  '134123412346',   // leading 1
  '23412341234',    // 11 digits
  '2341234123460',  // 13 digits
  '2341 2341 2346', // callers strip spaces first
  '23412341234a',
  '',
];

it('accepts Verhoeff-valid 12-digit numbers', () => {
  expect(VALID.filter((n) => !isValidAadhaar(n))).toEqual([]);
});

it('rejects a bad checksum, a leading 0 or 1, wrong lengths, spaces and non-digits', () => {
  expect(INVALID.filter(isValidAadhaar)).toEqual([]);
});

it('groups digits in fours for display, including partial input', () => {
  expect(formatAadhaar('')).toBe('');
  expect(formatAadhaar('2341')).toBe('2341');
  expect(formatAadhaar('23412')).toBe('2341 2');
  expect(formatAadhaar('234123412346')).toBe('2341 2341 2346');
});
```

In `src/api/__tests__/mock-artist.test.ts`:

1. Change the type import, and widen `ticket`'s `purpose` parameter:

```ts
import type { ArtistProfile, UploadPurpose, UploadTicket } from '../types';
```

```ts
async function ticket(t: MockTransport, auth: Record<string, string>, purpose: UploadPurpose) {
```

2. Add a helper right after `draft`:

```ts
/** Identity step with a generated (not real) Aadhaar number and two fresh card keys. */
async function kyc(t: MockTransport, auth: Record<string, string>, aadhaar_number = '234123412346') {
  const front = await ticket(t, auth, 'aadhaar');
  const back = await ticket(t, auth, 'aadhaar');
  return t.request({ method: 'PUT', path: '/artists/me/kyc', headers: auth, body: { aadhaar_number, front_key: front.key, back_key: back.key } });
}
```

3. In `complete`, change the doc comment to `/** Draft + one service + six photos + identity: ready to submit. */`, and add this as its last line:

```ts
  await kyc(t, auth);
```

4. In `upload tickets are scoped to the caller and purpose`, add this as the last line:

```ts
  expect((await ticket(t, auth, 'aadhaar')).key).toMatch(/^artists\/[^/]+\/aadhaar\/\d+$/);
```

5. In `PUT /artists/me/profile creates a trimmed draft…`, add `kyc: null` to the first `toMatchObject`, so it ends `…, services: [], photos: [], kyc: null });`.

6. Replace the last test (`the seeded artist has an approved profile`) with:

```ts
it('the seeded artist has an approved profile with Aadhaar on file', async () => {
  const t = new MockTransport();
  const auth = await signIn(t, '+15550009999');
  expect(await t.request({ method: 'GET', path: '/artists/me', headers: auth })).toMatchObject({ status: 200, json: { status: 'approved', kyc: { aadhaar_last4: '2346' } } });
});
```

7. Append:

```ts
it('PUT /artists/me/kyc runs the backend checks in order and returns only the last 4 digits', async () => {
  const t = new MockTransport();
  const auth = await artist(t);
  expect(await kyc(t, auth)).toMatchObject({ status: 404, json: { code: 'not_found' } }); // 1. no profile yet
  await draft(t, auth);

  const put = (body: object) => t.request({ method: 'PUT', path: '/artists/me/kyc', headers: auth, body });
  const invalid = (message: string) => ({ status: 422, json: { code: 'validation_error', message } });
  const front = await ticket(t, auth, 'aadhaar');
  const back = await ticket(t, auth, 'aadhaar');
  const portfolio = await ticket(t, auth, 'portfolio');
  const good = { aadhaar_number: '2341 2341 2346', front_key: front.key, back_key: back.key }; // spaces are stripped
  const foreign = 'artists/someone-else/aadhaar/1';

  expect(await put({ ...good, aadhaar_number: '234123412347', front_key: foreign })).toMatchObject(invalid('Invalid Aadhaar number')); // 3. number before keys
  expect(await put({ ...good, aadhaar_number: '134123412346' })).toMatchObject(invalid('Invalid Aadhaar number'));
  expect(await put({ ...good, front_key: foreign })).toMatchObject(invalid('Invalid photo key')); // 4. someone else's key
  expect(await put({ ...good, back_key: portfolio.key })).toMatchObject(invalid('Invalid photo key')); // 4. wrong purpose
  expect(await put({ ...good, back_key: front.key })).toMatchObject(invalid('Front and back must be different photos')); // 5.

  const saved = await put(good);
  expect(saved).toMatchObject({ status: 200, json: { kyc: { aadhaar_last4: '2346' } } });
  expect(JSON.stringify(saved.json)).not.toMatch(/234123412346|aadhaar\//); // never the number, the keys or a URL
  expect((await kyc(t, auth, '498765432102')).json).toMatchObject({ kyc: { aadhaar_last4: '2102' } }); // replace

  await complete(t, auth);
  expect(await t.request({ method: 'POST', path: '/artists/me/submit', headers: auth })).toMatchObject({ status: 200 });
  expect(await put({ ...good, aadhaar_number: '234123412347' })).toMatchObject({ status: 409, json: { code: 'conflict' } }); // 2. before the number
});
```

- [ ] **Step 2: Run them to confirm they fail**

Run: `npx jest src/artist/__tests__/aadhaar.test.ts src/api/__tests__/mock-artist.test.ts`
Expected: FAIL.
- `aadhaar.test.ts` fails with `Cannot find module '../aadhaar'`.
- In `mock-artist.test.ts`, the new kyc test fails: the first `kyc()` call gets `422 purpose must be artist_photo or portfolio` from the upload ticket. The ticket, draft and seeded tests fail too, because `kyc` is missing from the profile.

- [ ] **Step 3: Implement the types, the util and the endpoint**

In `src/api/types.ts`:
- in `ArtistProfile`, add the field after `photos`;
- replace `UploadPurpose`;
- add `KycInput` after `PhotoInput`.

```ts
  /** Identity proof on file. Only the last 4 digits ever reach the app: never the number, keys or images. */
  kyc: { aadhaar_last4: string } | null;
```

```ts
export type UploadPurpose = 'artist_photo' | 'portfolio' | 'aadhaar';
```

```ts
/** PUT /artists/me/kyc. All three are required on every call ("Replace details" re-sends everything). */
export interface KycInput {
  aadhaar_number: string;
  front_key: string;
  back_key: string;
}
```

In `src/api/endpoints/artist.ts`:
- add `KycInput` to the type import, which becomes `import type { ArtistProfile, KycInput, PhotoInput, ProfileInput, ServiceInput, UploadPurpose, UploadTicket } from '../types';`;
- add this after `reorderPhotos`:

```ts
export function saveKyc(body: KycInput) {
  return request<ArtistProfile>('/artists/me/kyc', body, { auth: true, method: 'PUT' });
}
```

Create `src/artist/aadhaar.ts`:

```ts
// Same rule as backend app/utils/aadhaar.py (keep them in lockstep): 12 digits, first digit 2–9,
// last digit a Verhoeff check digit. Use generated numbers only: 234123412346 passes, 234123412347 fails.

// Verhoeff tables: multiplication (dihedral group D5) and permutation, as published by Verhoeff (1969).
const D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 0, 6, 7, 8, 9, 5], [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7], [4, 0, 1, 2, 3, 9, 5, 6, 7, 8], [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2], [7, 6, 5, 9, 8, 2, 1, 0, 4, 3], [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];
const P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 5, 7, 6, 2, 8, 3, 0, 9, 4], [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7], [9, 4, 5, 3, 1, 2, 6, 8, 7, 0], [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5], [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

/** `digits` must already be stripped of spaces (the Identity screen keeps digits only). */
export function isValidAadhaar(digits: string): boolean {
  if (!/^[2-9]\d{11}$/.test(digits)) return false;
  let check = 0;
  [...digits].reverse().forEach((d, i) => { check = D[check][P[i % 8][Number(d)]]; });
  return check === 0;
}

/** "234123412346" → "2341 2341 2346"; partial input groups the same way ("23412" → "2341 2"). */
export function formatAadhaar(digits: string): string {
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
}
```

- [ ] **Step 4: Implement the mock**

In `src/api/mock/artist.ts`:

1. Add the import and a purpose list. Keep the existing type import (it already imports `UploadPurpose`), and add `import { isValidAadhaar } from '../../artist/aadhaar';` below it. After `EDITABLE`, add:

```ts
const PURPOSES: UploadPurpose[] = ['artist_photo', 'portfolio', 'aadhaar']; // backend UploadRequest.purpose
```

2. Add the kyc record to `MockProfile`. Add `interface MockKyc` above `MockProfile`, and add the field after `photos: MockPhoto[];`:

```ts
interface MockKyc { last4: string; front_key: string; back_key: string } // like artist_kyc, minus the (encrypted) number
```

```ts
  kyc: MockKyc | null;
```

3. In `out()`, add this after the `photos:` line:

```ts
      kyc: p.kyc ? { aadhaar_last4: p.kyc.last4 } : null,
```

4. Replace `uploadTicket`:

```ts
  uploadTicket(userId: string, purpose: unknown): TransportResponse {
    if (!PURPOSES.includes(purpose as UploadPurpose)) return err('validation_error', 'purpose must be artist_photo, portfolio or aadhaar', 422);
    return { status: 200, json: { upload_url: 'mock://upload', fields: {}, key: `artists/${userId}/${purpose as UploadPurpose}/${++this.seq}` } };
  }
```

5. In `handle`, add the route after the `PUT /artists/me/photos/order` line. It sits below the existing 404 and 409 checks, so the backend's checks 1 and 2 already run first:

```ts
    if (method === 'PUT' && path === '/artists/me/kyc') return this.saveKyc(userId, p, b);
```

6. In `saveProfile`'s new-profile literal, add `kyc: null` after `photos: []`:

```ts
      category_ids: [], services: [], photos: [], kyc: null, rejection_reason: null, submitted_at: null, reviewed_at: null,
```

7. Add `saveKyc` after `reorder`:

```ts
  /** Backend ArtistService.save_kyc checks 3–5, in order; only the last 4 digits and the keys are kept. */
  private saveKyc(userId: string, p: MockProfile, b: Record<string, unknown>): TransportResponse {
    const number = typeof b.aadhaar_number === 'string' ? b.aadhaar_number.replace(/ /g, '') : '';
    if (!isValidAadhaar(number)) return err('validation_error', 'Invalid Aadhaar number', 422);
    const front = typeof b.front_key === 'string' ? b.front_key : '';
    const back = typeof b.back_key === 'string' ? b.back_key : '';
    if (![front, back].every((key) => this.owns(key, userId, 'aadhaar'))) return err('validation_error', 'Invalid photo key', 422);
    if (front === back) return err('validation_error', 'Front and back must be different photos', 422);
    p.kyc = { last4: number.slice(-4), front_key: front, back_key: back };
    return this.ok(p);
  }
```

8. In `seedApproved`, replace the `photo_key: null, …` line so the profile gets a kyc record:

```ts
      photo_key: null, category_ids: [1, 2], services: [], photos: [], rejection_reason: null, submitted_at: now, reviewed_at: now,
      kyc: { last4: '2346', front_key: `artists/${userId}/aadhaar/seed-front`, back_key: `artists/${userId}/aadhaar/seed-back` },
```

(Don't add `kyc` to `submit()` yet. That rule lands in M2, together with the screen that satisfies it; see Decision 13.)

In `src/artist/__tests__/routing.test.ts`, add `kyc: null` to the `profile` fixture (it is now a required field), so its last line reads:

```ts
  rejection_reason: null, submitted_at: null, reviewed_at: null, kyc: null, ...over,
```

- [ ] **Step 5: Run tests, types and lint**

Run: `npx jest && npx tsc --noEmit && npx expo lint`
Expected:
- Jest: all pass, **87 tests** (83 plus 3 Aadhaar plus 1 mock kyc test). The onboarding integration tests are unchanged and still submit from Portfolio, because the mock doesn't require kyc yet.
- `tsc`: no output.
- Lint: no errors or warnings.

- [ ] **Step 6: Commit**

```bash
git add src/api/types.ts src/api/endpoints/artist.ts src/api/mock/artist.ts src/artist/aadhaar.ts src/artist/__tests__/aadhaar.test.ts src/artist/__tests__/routing.test.ts src/api/__tests__/mock-artist.test.ts
git commit -m "feat(mobile): Aadhaar types, Verhoeff check, saveKyc and mock /artists/me/kyc

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task M2: Identity step, 4-step flow, resume rule and copy

**Files:**
- Create: `app/artist/onboarding/identity.tsx`
- Modify:
  - `src/artist/routing.ts`, `src/api/mock/artist.ts` (`submit`);
  - `app/artist/onboarding/{portfolio,profile,services,intro,_layout}.tsx`, `app/artist/in-review.tsx`;
  - `README.md`.
- Test: `src/artist/__tests__/routing.test.ts`, `src/api/__tests__/mock-artist.test.ts`, `src/__tests__/artist-onboarding.test.tsx`

**Interfaces:**
- Consumes (M1): `saveKyc`, `KycInput`, `ArtistProfile.kyc`, `isValidAadhaar`, `formatAadhaar`, `uploadImage(image, 'aadhaar')`.
- Consumes (existing):
  - `useArtistProfile`, `useArtistWrite`, `pickImages`, `errorMessage`;
  - `FormScreen` (`onBack`, `step`, `steps`, `footer`), `FormHeading` (`eyebrow`, `title`, `accent`, `subtitle`);
  - `AppTextField` (`label`, `error`, TextInput props), `AppButton` (`label`, `onPress`, `loading`, `disabled`).
- Produces:
  - route `/artist/onboarding/identity`;
  - `ResumeStep` adds `'identity'`;
  - in the mock, submit's `missing` adds `'kyc'`;
  - test helpers `fillIdentity`, `submitIdentity` and `toIdentity` in `artist-onboarding.test.tsx`.

- [ ] **Step 1: Write the failing unit tests (routing and mock submit)**

In `src/artist/__tests__/routing.test.ts`:
- add a six-photo fixture below `service`;
- replace the `a draft resumes…` test;
- in `artistHref maps each stage…`, add a line after the `/artist/onboarding/portfolio` expectation.

```ts
const photos = Array.from({ length: 6 }, (_, i) => ({ id: `p${i}`, key: `k${i}`, width: 1, height: 1, thumb_url: 'u', card_url: 'u', full_url: 'u' }));
```

```ts
it('a draft resumes at the first step the server has no data for; six photos go on to Identity', () => {
  expect(resumeStep(null)).toBe('intro');
  expect(resumeStep(profile())).toBe('services');
  expect(resumeStep(profile({ services: [service] }))).toBe('portfolio');
  expect(resumeStep(profile({ services: [service], photos: photos.slice(0, 5) }))).toBe('portfolio');
  expect(resumeStep(profile({ services: [service], photos }))).toBe('identity');
  expect(resumeStep(profile({ services: [service], photos, kyc: { aadhaar_last4: '2346' } }))).toBe('identity'); // on file: submit from there
});
```

```ts
  expect(artistHref(profile({ services: [service], photos }), false)).toBe('/artist/onboarding/identity');
```

In `src/api/__tests__/mock-artist.test.ts`, in `submit lists what is missing…`, change the expected list to `missing: ['services', 'portfolio', 'kyc']`.

- [ ] **Step 2: Update the existing integration tests and add the Identity ones**

In `src/__tests__/artist-onboarding.test.tsx`:

1. Progress bars are out of 4 now. Replace each `'Step 1 of 3'` with `'Step 1 of 4'`, `'Step 2 of 3'` with `'Step 2 of 4'` (in `fillProfile` and in the Profile-disabled test), and `'Step 3 of 3'` with `'Step 3 of 4'` (both lines of the Services test). In the Intro test, replace `'3 short steps'` with `'4 short steps'`.

2. Below the `afterEach` line, add:

```ts
const INVALID = 'That doesn’t look like a valid Aadhaar number.';
```

3. Right after `addPhotos`, add the Identity helpers:

```ts
/** Identity: type the number and upload both sides of the card; leaves Submit for review enabled. */
async function fillIdentity(number = '234123412346') {
  expect(await screen.findByText('Confirm it’s you')).toBeTruthy();
  expect(screen.getByLabelText('Step 4 of 4')).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('Aadhaar number'), number);
  for (const side of ['front', 'back']) {
    mockPicks(1);
    await fireEvent.press(screen.getByLabelText(`Add ${side} of card`));
    expect(await screen.findByLabelText(`Retake ${side} of card`)).toBeTruthy();
  }
}

/** Submit for review from Identity; ends on the In review timeline. */
async function submitIdentity() {
  await fireEvent.press(screen.getByText('Submit for review'));
  expect(await screen.findByText('Your profile is in review')).toBeTruthy();
}
```

4. In the Portfolio test:
   - Rename it to `'Portfolio: counts toward six, marks the cover, Make cover and Remove work, then Continue opens Identity, which submits to In review'`.
   - Replace its last four lines (from `await addPhotos(2, 6);` to the end of the test body) with:

```ts
  await addPhotos(2, 6);
  await fireEvent.press(await screen.findByText('Continue'));
  await fillIdentity();
  await submitIdentity();
  expect(screen.getByText('Profile submitted')).toBeTruthy();
  expect(screen.getByText('Identity & portfolio check')).toBeTruthy();
```

5. Replace `submitFor` with `toIdentity` plus a new `submitFor`:

```ts
/** Profile, one service and six photos for a fresh number; ends on Identity. */
async function toIdentity(national: string) {
  await startArtist(national);
  await fillProfile();
  await addService();
  await fireEvent.press(screen.getByText('Continue'));
  await addPhotos(6);
  await fireEvent.press(await screen.findByText('Continue'));
}

/** Runs the whole flow to In review for a fresh number. */
async function submitFor(national: string) {
  await toIdentity(national);
  await fillIdentity();
  await submitIdentity();
}
```

6. In the rejection test, replace its last five lines (from the `await fireEvent.press(screen.getByText('Continue'));` right after the `prefilled from the saved profile` assertion, to the end of the test body) with:

```ts
  await fireEvent.press(screen.getByText('Continue'));
  expect(await screen.findByText('Bridal mehendi')).toBeTruthy();
  await fireEvent.press(screen.getByText('Continue'));
  expect(await screen.findByText('Show your best work')).toBeTruthy();
  await fireEvent.press(screen.getByText('Continue'));
  // The app never gets the number or the photos back: it shows the last 4 digits, and resubmits without re-entering them.
  expect(await screen.findByText('Aadhaar on file •••• 2346')).toBeTruthy();
  expect(screen.queryByLabelText('Aadhaar number')).toBeNull();
  const spy = jest.spyOn(transport, 'request');
  try {
    await submitIdentity();
    expect(spy.mock.calls.map(([r]) => r.path)).not.toContain('/artists/me/kyc');
  } finally {
    spy.mockRestore();
  }
```

7. Append three tests after `quitting mid-way resumes at the first incomplete step`:

```ts
it('Identity: groups the number, flags a bad checksum on blur, and a failed submit keeps the artist on the step', async () => {
  await toIdentity('9845044450');
  const field = () => screen.getByLabelText('Aadhaar number');
  await fireEvent.changeText(field(), '2341-2341-2347-99'); // non-digits dropped, capped at 12
  expect(field().props.value).toBe('2341 2341 2347');
  expect(screen.queryByText(INVALID)).toBeNull(); // not while typing
  await fireEvent(field(), 'blur');
  expect(await screen.findByText(INVALID)).toBeTruthy();
  await fireEvent.changeText(field(), '234123412346');
  await waitFor(() => expect(screen.queryByText(INVALID)).toBeNull());

  await fillIdentity();
  const real = transport.request.bind(transport);
  const spy = jest.spyOn(transport, 'request').mockImplementation((r) =>
    r.path === '/artists/me/submit' ? Promise.resolve({ status: 500, json: null }) : real(r));
  try {
    await fireEvent.press(screen.getByText('Submit for review'));
    expect(await screen.findByText('Something went wrong. Please try again.')).toBeTruthy();
    expect(screen.getByText('Confirm it’s you')).toBeTruthy();
    // The details were saved before submit failed, so they are on file and the retry only submits.
    expect(screen.getByText('Aadhaar on file •••• 2346')).toBeTruthy();
    spy.mockClear();
    spy.mockImplementation(real);
    await submitIdentity();
    expect(spy.mock.calls.map(([r]) => r.path)).not.toContain('/artists/me/kyc');
  } finally {
    spy.mockRestore();
  }
});

it('Replace details after a rejection needs the number and both photos again', async () => {
  await submitFor('9845044451');
  mock.review('+919845044451', 'rejected', 'Aadhaar photo is unreadable');
  await queryClient.invalidateQueries({ queryKey: ['artist'] });
  await fireEvent.press(await screen.findByText('Edit and resubmit'));
  expect(await screen.findByText('Tell clients who you are')).toBeTruthy();
  await fireEvent.press(screen.getByText('Continue'));
  expect(await screen.findByText('Bridal mehendi')).toBeTruthy();
  await fireEvent.press(screen.getByText('Continue'));
  expect(await screen.findByText('Show your best work')).toBeTruthy();
  await fireEvent.press(screen.getByText('Continue'));
  await fireEvent.press(await screen.findByText('Replace details'));
  expect(screen.getByLabelText('Aadhaar number').props.value).toBe('');
  expect(screen.getByLabelText('Add front of card')).toBeTruthy();
  expect(screen.queryByText(/^Aadhaar on file/)).toBeNull();

  const spy = jest.spyOn(transport, 'request');
  const kycPuts = () => spy.mock.calls.filter(([r]) => r.path === '/artists/me/kyc');
  try {
    await fireEvent.press(screen.getByText('Submit for review')); // nothing entered
    await fireEvent.changeText(screen.getByLabelText('Aadhaar number'), '498765432102');
    await fireEvent.press(screen.getByText('Submit for review')); // no photos
    mockPicks(1);
    await fireEvent.press(screen.getByLabelText('Add front of card'));
    expect(await screen.findByLabelText('Retake front of card')).toBeTruthy();
    await fireEvent.press(screen.getByText('Submit for review')); // no back photo
    expect(kycPuts()).toHaveLength(0);
    expect(screen.getByText('Confirm it’s you')).toBeTruthy();

    mockPicks(1);
    await fireEvent.press(screen.getByLabelText('Add back of card'));
    expect(await screen.findByLabelText('Retake back of card')).toBeTruthy();
    await submitIdentity();
    expect(kycPuts()).toHaveLength(1);
    expect(kycPuts()[0][0].body).toMatchObject({ aadhaar_number: '498765432102' });
  } finally {
    spy.mockRestore();
  }
});

it('quitting on Identity resumes there at step 4 of 4, and Back returns to Portfolio', async () => {
  await toIdentity('9845044452');
  await screen.unmount();
  queryClient.clear();
  await renderRouter('./app');
  expect(await screen.findByText('Confirm it’s you')).toBeTruthy();
  expect(screen.getByLabelText('Step 4 of 4')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Back'));
  expect(await screen.findByText('Show your best work')).toBeTruthy();
});
```

- [ ] **Step 3: Run them to confirm they fail**

Run: `npx jest src/artist/__tests__/routing.test.ts src/api/__tests__/mock-artist.test.ts src/__tests__/artist-onboarding.test.tsx`
Expected: FAIL.
- In routing, `resumeStep` returns `'portfolio'` where `'identity'` is expected.
- In the mock, `missing` lacks `'kyc'`.
- In onboarding, `Step 1 of 4` and `4 short steps` aren't found, and the Identity tests time out waiting for "Confirm it’s you".

The categories-retry test and the zero-price test still pass.

- [ ] **Step 4: Resume rule and the mock's submit rule**

In `src/artist/routing.ts`, replace the `ResumeStep` type and `resumeStep`:

```ts
export type ResumeStep = 'intro' | 'services' | 'portfolio' | 'identity';
const MIN_PHOTOS = 6; // backend artist_service.MIN_PHOTOS
```

```ts
/** Spec §2.1: each Continue saves, so a returning artist resumes at the first step the server has no data for. */
export function resumeStep(profile: ArtistProfile | null): ResumeStep {
  if (!profile) return 'intro'; // the Profile step creates the row, so a saved row always has profile details
  if (!profile.services.length) return 'services';
  if (profile.photos.length < MIN_PHOTOS) return 'portfolio';
  return 'identity'; // with or without kyc on file: Identity is also where the artist submits
}
```

In `src/api/mock/artist.ts`, in `submit()`, add this after the `portfolio` line:

```ts
    if (!p.kyc) missing.push('kyc');
```

- [ ] **Step 5: The Identity screen**

Create `app/artist/onboarding/identity.tsx`:

```tsx
import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { FormScreen, FormHeading } from '../../../src/components/FormScreen';
import { AppText } from '../../../src/components/AppText';
import { AppButton } from '../../../src/components/AppButton';
import { AppTextField } from '../../../src/components/AppTextField';
import { useTheme } from '../../../src/theme/theme-provider';
import { useArtistProfile, useArtistWrite } from '../../../src/artist/queries';
import { pickImages, uploadImage } from '../../../src/artist/upload';
import { formatAadhaar, isValidAadhaar } from '../../../src/artist/aadhaar';
import * as artistApi from '../../../src/api/endpoints/artist';
import type { KycInput } from '../../../src/api/types';
import { errorMessage } from '../../../src/api/error-message';

const INVALID = 'That doesn’t look like a valid Aadhaar number.';

/** One side of the card: the local preview and, once uploaded, its private storage key. */
interface Side { uri: string | null; key: string | null; uploading: boolean }
type SideName = 'front' | 'back';
const EMPTY: Record<SideName, Side> = {
  front: { uri: null, key: null, uploading: false },
  back: { uri: null, key: null, uploading: false },
};

// Step 4 of 4 (spec §2.2; not drawn in the design): Aadhaar number and both sides of the card, then Submit for review.
// The server never sends the number or the photos back, so details on file show only the last 4 digits.
export default function IdentityStep() {
  const theme = useTheme();
  const router = useRouter();
  const { data: profile } = useArtistProfile();
  const write = useArtistWrite();
  const [replacing, setReplacing] = useState(false);
  const [digits, setDigits] = useState('');
  const [checked, setChecked] = useState(false); // validate on blur and on submit, not while typing
  const [sides, setSides] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onFile = replacing ? null : profile?.kyc ?? null;
  const valid = isValidAadhaar(digits);
  const { front, back } = sides;
  // A key is only set once its upload finished, so both keys mean nothing is still uploading.
  const details: KycInput | null = !onFile && valid && front.key && back.key
    ? { aadhaar_number: digits, front_key: front.key, back_key: back.key }
    : null;
  const ready = !!onFile || !!details;

  const choose = async (name: SideName) => {
    const previous = sides[name];
    setError(null);
    try {
      const [image] = await pickImages(1);
      if (!image) return;
      setSides((s) => ({ ...s, [name]: { uri: image.uri, key: null, uploading: true } }));
      const { key } = await uploadImage(image, 'aadhaar');
      setSides((s) => ({ ...s, [name]: { uri: image.uri, key, uploading: false } }));
    } catch (e) {
      setSides((s) => ({ ...s, [name]: previous })); // a failed retake keeps the photo already uploaded
      setError(errorMessage(e));
    }
  };

  const replace = () => { // spec §2.2: an empty form; the number and both photos are required again
    setDigits('');
    setSides(EMPTY);
    setChecked(false);
    setError(null);
    setReplacing(true);
  };

  const submit = async () => {
    if (!onFile) setChecked(true);
    if (!ready || submitting) return; // disabled buttons still reach onPress under RNTL
    setSubmitting(true);
    setError(null);
    try {
      if (details) {
        await write(() => artistApi.saveKyc(details));
        setReplacing(false); // now on file, so a failed submit retries without re-sending the details
      }
      await write(artistApi.submitProfile); // status → pending; the artist layout moves to In review
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormScreen
      onBack={() => router.dismissTo('/artist/onboarding/portfolio')}
      step={4}
      steps={4}
      footer={<AppButton label="Submit for review" onPress={() => { void submit(); }} loading={submitting} disabled={!ready} />}
    >
      <FormHeading eyebrow="STEP 4 · IDENTITY" title="Confirm it’s" accent="you" subtitle="We use your Aadhaar only to verify your identity." />
      {onFile ? (
        <View style={{ marginTop: 20, padding: 14, gap: 8, borderRadius: theme.radii.md, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.separator }}>
          <AppText variant="label" style={{ fontSize: 15, color: theme.colors.textPrimary }}>{`Aadhaar on file •••• ${onFile.aadhaar_last4}`}</AppText>
          <Pressable accessibilityRole="button" onPress={replace} hitSlop={8} style={{ alignSelf: 'flex-start' }}>
            <AppText variant="label" style={{ color: theme.colors.brand }}>Replace details</AppText>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={{ marginTop: 20 }}>
            <AppTextField
              label="Aadhaar number"
              value={formatAadhaar(digits)}
              onChangeText={(t) => setDigits(t.replace(/\D/g, '').slice(0, 12))}
              onBlur={() => setChecked(true)}
              keyboardType="number-pad"
              maxLength={14}
              placeholder="1234 5678 9012"
              error={checked && !valid ? INVALID : null}
            />
          </View>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
            <CardSide title="Front" side={front} onPress={() => { void choose('front'); }} />
            <CardSide title="Back" side={back} onPress={() => { void choose('back'); }} />
          </View>
        </>
      )}
      <View style={{ marginTop: 16, padding: 14, borderRadius: 14, backgroundColor: theme.colors.washTop }}>
        <AppText variant="caption" style={{ color: theme.colors.textSecondary, lineHeight: 19 }}>
          Your Aadhaar is encrypted and only seen by our verification team.
        </AppText>
      </View>
      {error ? <AppText variant="caption" style={{ color: theme.colors.error, marginTop: theme.spacing.md }}>{error}</AppText> : null}
    </FormScreen>
  );
}

/** Front or back tile: tap to pick and upload, a spinner while uploading, then the local preview with "Retake". */
function CardSide({ title, side, onPress }: { title: 'Front' | 'Back'; side: Side; onPress: () => void }) {
  const theme = useTheme();
  const name = `${title.toLowerCase()} of card`;
  return (
    <View style={{ flex: 1, gap: 6 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={side.uploading ? `Uploading ${name}` : side.key ? `Retake ${name}` : `Add ${name}`}
        disabled={side.uploading}
        onPress={onPress}
        style={{
          aspectRatio: 1.58, borderRadius: 14, overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
          borderWidth: 1.5, borderStyle: side.uri ? 'solid' : 'dashed', borderColor: theme.colors.border,
          backgroundColor: side.uri ? theme.colors.imageFallback : theme.colors.washTop,
        }}
      >
        {side.uri ? (
          <Image source={{ uri: side.uri }} contentFit="cover" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: side.uploading ? 0.5 : 1 }} />
        ) : (
          <AppText style={{ fontSize: 22, color: theme.colors.brand }}>+</AppText>
        )}
        {side.uploading ? <ActivityIndicator color={theme.colors.brand} /> : null}
      </Pressable>
      <AppText variant="label" style={{ fontSize: 13, color: theme.colors.textSecondary }}>
        {title}
        {side.key ? <AppText variant="label" style={{ fontSize: 13, color: theme.colors.brand }}> · Retake</AppText> : null}
      </AppText>
    </View>
  );
}
```

- [ ] **Step 6: Portfolio Continue, 4-step progress and copy**

`app/artist/onboarding/portfolio.tsx`:
- Change the header comment to `// Atelier hi-fi "onbPortfolio" (step 3 of 4): the first photo is the cover; long-press a tile for Make cover / Remove. Continue opens Identity.`
- Delete the line `const submit = () => run(() => write(artistApi.submitProfile)); // status → pending; the artist layout moves to In review`. (`run`, `write` and `artistApi` are still used by `add`, `makeCover` and `remove`.)
- Change `steps={3}` to `steps={4}`.
- Replace the footer `AppButton` with:

```tsx
        <AppButton
          label={enough ? 'Continue' : `Continue · ${count} of ${MIN_PHOTOS} photos`}
          onPress={() => { if (enough && uploading.length === 0) router.push('/artist/onboarding/identity'); }}
          disabled={!enough || uploading.length > 0}
        />
```

`app/artist/onboarding/profile.tsx`: change `steps={3}` to `steps={4}`, and change the header comment's `(step 1 of 3)` to `(step 1 of 4)`.

`app/artist/onboarding/services.tsx`: change `steps={3}` to `steps={4}`, and change the header comment's `// Step 2 of 3` to `// Step 2 of 4`.

`app/artist/onboarding/intro.tsx`: change the caption text `3 short steps` to `4 short steps`, and change the header comment's `"3 short steps"` to `"4 short steps"`.

`app/artist/onboarding/_layout.tsx`: change the first comment line to `// Intro → Profile → Services → Portfolio → Identity. The artist layout guards the whole group; steps`.

`app/artist/in-review.tsx`: change the middle milestone to:

```tsx
              <Milestone state="current" title="Identity & portfolio check" detail="In progress · usually 24–48 hrs" />
```

- [ ] **Step 7: README**

In `README.md`, under "### Artist onboarding in mock mode", replace the first sentence ("Choose role → "Create your profile" runs Intro → Profile → Services → Portfolio → In review entirely against `MockTransport` (…).") with:

```
Choose role → "Create your profile" runs Intro → Profile → Services → Portfolio → Identity → In review entirely
against `MockTransport` (categories are the design's six; picked photos are kept as local URIs).
Identity accepts only Verhoeff-valid Aadhaar numbers: use generated ones such as `234123412346`, never a real one.
```

In the next sentence, change `` `+1 555 000 9999` is a seeded, already-approved artist. `` to `` `+1 555 000 9999` is a seeded, already-approved artist (Aadhaar on file, last 4 `2346`). ``

- [ ] **Step 8: Run tests, types and lint**

Run: `npx jest && npx tsc --noEmit && npx expo lint`
Expected:
- Jest: all pass, **90 tests** (87 plus the 3 new Identity tests).
- `tsc`: no output.
- Lint: no errors or warnings. In particular, no `set-state-in-effect` and no unused imports, because `portfolio.tsx` keeps using `artistApi`.

If a long integration test hits Jest's 5 s default timeout on a slow machine, give that test a third `it` argument of `15_000`. Don't loosen any assertion.

- [ ] **Step 9: Check nothing else still says three steps**

Run: `grep -rn "steps={3}\|of 3 photos\|3 short steps\|Portfolio check" app src`
Expected: no output. The auth screens use `FormScreen`'s default (`AUTH_STEPS`), so `auth-flow.test.tsx`'s `Step 1 of 3` and `Step 3 of 3` correctly stay as they are.

- [ ] **Step 10: Commit**

```bash
git add app/artist/onboarding/identity.tsx app/artist/onboarding/portfolio.tsx app/artist/onboarding/profile.tsx app/artist/onboarding/services.tsx app/artist/onboarding/intro.tsx app/artist/onboarding/_layout.tsx app/artist/in-review.tsx src/artist/routing.ts src/api/mock/artist.ts src/artist/__tests__/routing.test.ts src/api/__tests__/mock-artist.test.ts src/__tests__/artist-onboarding.test.tsx README.md
git commit -m "feat(mobile): onboarding Identity step (Aadhaar), 4-step progress and resume

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Part 3 (admin)

Implements spec §3 exactly, against the backend as built:
- `GET /api/v1/admin/artists/{id}` returns `kyc: {aadhaar_masked, front_url, back_url} | null` (`AdminKycOut`). Both URLs are private links valid for 300 s. Approve and Reject return the same `AdminArtistDetail`, so they also carry fresh links.
- `POST /api/v1/admin/artists/{id}/kyc/reveal` returns `{aadhaar_number}` (`RevealOut`) with `Cache-Control: no-store`. It answers `404` when there is no KYC row and `403` for non-admins.

### Global Constraints (Part 3)

- **Commands:** run from `admin/`.
  - Tests: `npm test` (`vitest run`): 6 pass before Part 3, and 10 after A1.
  - Types: `npm run typecheck` (`tsc -b`, which also checks `src/App.test.tsx`).
  - Lint: `npm run lint` (`oxlint`). Before Part 3 it reports 0 errors and 3 warnings, all `only-export-components` in `src/components/ui/{badge,button,tabs}.tsx`. Part 3 adds none.
- **The full number never enters a cache.** It isn't in the query cache, the mutation cache, storage or the console. It lives only in the Identity card's component state (Decision 15).
- **Approve, Reject and the queue are unchanged.** `ArtistQueuePage.tsx` and `useReviewArtist` are not touched, and Approve is never gated on `kyc`.
- **Copy (exact):** `Identity (Aadhaar)`, `Reveal`, `Reveals are logged.`, `No Aadhaar on file`, `Front`, `Back`.
- **Test Aadhaar numbers** are generated only: `234123412346`, masked `•••• •••• 2346`, shown revealed as `2341 2341 2346`.
- **Commits:** every commit message ends with a blank line and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never `git commit --amend`.

### File structure (Part 3)

| File | Responsibility |
|---|---|
| `src/lib/types.ts` (modify) | `AdminKyc`; `ArtistDetail.kyc` |
| `src/features/artists/queries.ts` (modify) | `revealAadhaar(id)`: a plain call, not a hook |
| `src/features/artists/ArtistReviewPage.tsx` (modify) | `IdentityCard` above Services; the image dialog shows `Viewing {title, url}` |
| `src/App.test.tsx` (modify) | `KYC` fixture, the fake reveal route, and 4 tests |

---

### Task A1: Identity (Aadhaar) card on the artist review page

**Files:**
- Modify: `src/lib/types.ts`, `src/features/artists/queries.ts`, `src/features/artists/ArtistReviewPage.tsx`
- Test: `src/App.test.tsx`

**Interfaces:**
- Consumes: `AdminArtistDetail.kyc` and `POST /admin/artists/{id}/kyc/reveal` (B4); `api` and `ApiError` (`src/lib/api.ts`); `useArtist(id).refetch`.
- Produces:
  - `interface AdminKyc { aadhaar_masked: string; front_url: string; back_url: string }`;
  - `ArtistDetail.kyc: AdminKyc | null`;
  - `revealAadhaar(id: string): Promise<{ aadhaar_number: string }>`;
  - `IdentityCard` (file-local in `ArtistReviewPage.tsx`) and `type Viewing = { title: string; url: string }`.

- [ ] **Step 1: Write the failing tests**

In `src/App.test.tsx`:

1. Change the first import to add `fireEvent`, and add `AdminKyc` to the type import:

```tsx
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
```

```tsx
import type { AdminCategory, AdminKyc, ArtistDetail, User } from './lib/types'
```

2. Add the fixture directly above `function artist(`:

```tsx
// Generated Aadhaar number (not a real person's): 234123412346, so the masked form ends 2346.
const KYC: AdminKyc = {
  aadhaar_masked: '•••• •••• 2346',
  front_url: 'https://fake.storage/private/artists/u-1/aadhaar/front.jpg?expires_at=1',
  back_url: 'https://fake.storage/private/artists/u-1/aadhaar/back.jpg?expires_at=1',
}
```

3. In `artist()`, change `photos: [], rejection_reason: null,` to `photos: [], kyc: KYC, rejection_reason: null,`.

4. In `route()`, add this directly above the final `return json(404, …)`:

```tsx
  if (method === 'POST' && path === `/admin/artists/${db.artist.id}/kyc/reveal`) {
    return db.artist.kyc ? json(200, { aadhaar_number: '234123412346' }) : json(404, { code: 'not_found', message: 'No Aadhaar on file' })
  }
```

5. Append:

```tsx
it('shows the masked Aadhaar above Services, and both card photos open full size', async () => {
  const user = userEvent.setup()
  renderSignedIn('/artists/a-1')
  expect(await screen.findByText('•••• •••• 2346')).toBeInTheDocument()
  expect(screen.getByText('Reveals are logged.')).toBeInTheDocument()
  expect(screen.getByText('Identity (Aadhaar)').compareDocumentPosition(screen.getByText('Services · 1')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(screen.getByAltText('Aadhaar front')).toHaveAttribute('src', KYC.front_url)
  expect(screen.getByAltText('Aadhaar back')).toHaveAttribute('src', KYC.back_url)

  await user.click(screen.getByRole('button', { name: 'Open Aadhaar back' }))
  const dialog = await screen.findByRole('dialog')
  expect(dialog.querySelector('img')).toHaveAttribute('src', KYC.back_url)
})

it('Reveal POSTs to the reveal endpoint and shows the full number without caching it', async () => {
  const user = userEvent.setup()
  const queryClient = createQueryClient()
  localStorage.setItem('atelier-admin.refresh', 'refresh')
  window.history.pushState({}, '', '/artists/a-1')
  render(<App queryClient={queryClient} />)

  await user.click(await screen.findByRole('button', { name: 'Reveal' }))
  expect(await screen.findByText('2341 2341 2346')).toBeInTheDocument()
  expect(screen.queryByText('•••• •••• 2346')).not.toBeInTheDocument()
  expect(calls).toContainEqual({ method: 'POST', path: '/admin/artists/a-1/kyc/reveal', body: undefined })
  const cached = [...queryClient.getQueryCache().getAll(), ...queryClient.getMutationCache().getAll()].map((entry) => entry.state.data)
  expect(JSON.stringify(cached)).not.toContain('234123412346')
})

it('says "No Aadhaar on file" when there is none, and Approve still works', async () => {
  db.artist = artist({ kyc: null })
  const user = userEvent.setup()
  renderSignedIn('/artists/a-1')
  expect(await screen.findByText('No Aadhaar on file')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Reveal' })).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Approve' }))
  expect(await screen.findByText('Approved')).toBeInTheDocument()
})

it('refetches the detail once when the card links have expired', async () => {
  const detailGets = () => calls.filter((c) => c.method === 'GET' && c.path === '/admin/artists/a-1').length
  renderSignedIn('/artists/a-1')
  await screen.findByAltText('Aadhaar front')
  expect(detailGets()).toBe(1)

  const fresh = { ...KYC, front_url: KYC.front_url.replace('expires_at=1', 'expires_at=2'), back_url: KYC.back_url.replace('expires_at=1', 'expires_at=2') }
  db.artist = artist({ kyc: fresh })
  fireEvent.error(screen.getByAltText('Aadhaar front'))
  fireEvent.error(screen.getByAltText('Aadhaar back')) // both expire together: still one refetch
  await waitFor(() => expect(screen.getByAltText('Aadhaar front')).toHaveAttribute('src', fresh.front_url))
  expect(screen.getByAltText('Aadhaar back')).toHaveAttribute('src', fresh.back_url)

  fireEvent.error(screen.getByAltText('Aadhaar front')) // broken again: no second refetch, no loop
  await new Promise((resolve) => setTimeout(resolve, 50))
  expect(detailGets()).toBe(2)
})
```

(jsdom never loads images, so `fireEvent.error` stands in for an expired link. The dialog's image has `alt=""`, so it has no `img` role, and the test reads it with `querySelector`.)

- [ ] **Step 2: Run them to confirm they fail**

Run: `npm test`
Expected: FAIL, with **4 failed and 6 passed (10)**. The four new tests fail because there is no `•••• •••• 2346`, `No Aadhaar on file` or `Aadhaar front` on the page, and no `Reveal` button. The six existing tests still pass (Vitest doesn't type-check, so `kyc` on the fixture is harmless at runtime).

- [ ] **Step 3: Add the type and the reveal call**

In `src/lib/types.ts`, add this after `interface Photo { … }`:

```ts
/** Admin-only view of the artist's Aadhaar: the number is masked, and both links are private and expire after 5 minutes. */
export interface AdminKyc {
  aadhaar_masked: string // "•••• •••• 2346"
  front_url: string
  back_url: string
}
```

In `ArtistDetail`, add this after `photos: Photo[]`:

```ts
  kyc: AdminKyc | null // null: submitted before Aadhaar verification existed
```

In `src/features/artists/queries.ts`, append (Decision 15):

```ts
/** Logged by the server. Not a query or a mutation on purpose: the full number lives only in the caller's component state. */
export function revealAadhaar(id: string) {
  return api<{ aadhaar_number: string }>(`/admin/artists/${id}/kyc/reveal`, { method: 'POST' })
}
```

- [ ] **Step 4: Add the Identity card and share the image dialog**

In `src/features/artists/ArtistReviewPage.tsx`:

1. Change these imports:

```tsx
import { useRef, useState } from 'react'
```

```tsx
import { ArrowLeft, Check, Eye, X } from 'lucide-react'
```

```tsx
import type { AdminKyc, ArtistStatus } from '@/lib/types'
import { revealAadhaar, useArtist, useReviewArtist } from './queries'
```

(`Photo` is no longer imported: the dialog state below replaces its only use.)

2. Add this above `const STATUS`:

```tsx
/** What the full-size image dialog shows: a portfolio photo or one side of the Aadhaar card. */
type Viewing = { title: string; url: string }
```

3. Change `const [viewing, setViewing] = useState<Photo | null>(null)` to:

```tsx
  const [viewing, setViewing] = useState<Viewing | null>(null)
```

4. At the top of the main column, directly inside `<div className="space-y-6">` and above the Services `<Card>`, add:

```tsx
          <IdentityCard key={a.id} artistId={a.id} kyc={a.kyc} onView={setViewing} onExpired={() => { void artist.refetch() }} />

```

5. In the portfolio grid, change the button's `onClick={() => setViewing(p)}` to:

```tsx
onClick={() => setViewing({ title: 'Portfolio photo', url: p.full_url })}
```

6. In the image dialog (the second `<Dialog>`), replace its title and image lines with:

```tsx
          <DialogTitle className="sr-only">{viewing?.title}</DialogTitle>
          {viewing && <img src={viewing.url} alt="" className="max-h-[80vh] w-full rounded-md object-contain" />}
```

7. Add the card above `function Row(`:

```tsx
/**
 * Spec §3.1. The full number comes from a plain call held in this component's state (never the query or
 * mutation cache), so it disappears when the admin leaves the page. Keyed by artist id by the caller.
 */
function IdentityCard({ artistId, kyc, onView, onExpired }: {
  artistId: string
  kyc: AdminKyc | null
  onView: (image: Viewing) => void
  onExpired: () => void
}) {
  const [revealed, setRevealed] = useState<string | null>(null)
  const [revealing, setRevealing] = useState(false)
  const refreshed = useRef(false) // a ref, so front and back failing in the same tick still refetch only once

  const reveal = async () => {
    setRevealing(true)
    try {
      setRevealed((await revealAadhaar(artistId)).aadhaar_number)
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.')
    } finally {
      setRevealing(false)
    }
  }

  // The card links expire after 5 minutes. On the first broken image, refetch the detail once for fresh links.
  const expired = () => {
    if (refreshed.current) return
    refreshed.current = true
    onExpired()
  }

  return (
    <Card>
      <CardHeader><CardTitle>Identity (Aadhaar)</CardTitle></CardHeader>
      <CardContent>
        {!kyc ? (
          <p className="text-sm text-muted-foreground">No Aadhaar on file</p>
        ) : (
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-3">
                <span className="text-lg font-semibold tracking-wide tabular-nums">
                  {revealed ? revealed.replace(/(\d{4})(?=\d)/g, '$1 ') : kyc.aadhaar_masked}
                </span>
                {!revealed && (
                  <Button variant="outline" size="sm" onClick={() => { void reveal() }} disabled={revealing}>
                    <Eye /> {revealing ? 'Revealing…' : 'Reveal'}
                  </Button>
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Reveals are logged.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {([['Front', kyc.front_url], ['Back', kyc.back_url]] as const).map(([side, url]) => (
                <button
                  key={side}
                  type="button"
                  onClick={() => onView({ title: `Aadhaar ${side.toLowerCase()}`, url })}
                  className="overflow-hidden rounded-lg bg-muted text-left"
                  aria-label={`Open Aadhaar ${side.toLowerCase()}`}
                >
                  <img src={url} alt={`Aadhaar ${side.toLowerCase()}`} onError={expired} className="aspect-[3/2] w-full object-cover" />
                  <span className="block px-2 py-1 text-xs font-medium text-muted-foreground">{side}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

Approve, Reject, the header and the side column are unchanged.

- [ ] **Step 5: Run tests, types and lint**

Run: `npm test && npm run typecheck && npm run lint`
Expected:
- Vitest: all pass, **10 tests** (6 plus 4 new).
- `tsc -b`: no errors. Before Step 3 it fails on the fixture's `kyc`; that is how you know `ArtistDetail.kyc` is required.
- oxlint: 0 errors, and the same 3 pre-existing `only-export-components` warnings in `src/components/ui/`. Nothing in `src/features/artists/` or `src/App.test.tsx`.

If the "refetches once" test fails with `detailGets()` at 3, the flag is in `useState` instead of `useRef`: both `onError` handlers then read the stale `false`. Use the ref; don't loosen the assertion.

- [ ] **Step 6: Check by hand (optional, needs the backend running with a submitted artist)**

Run: `npm run dev`, sign in as an admin, and open a pending artist.
Expected:
- The Identity (Aadhaar) card is first in the main column, with the masked number, a Reveal button, "Reveals are logged." and both card photos.
- Reveal shows the 12 digits, and the network tab shows a `POST …/kyc/reveal` answered with `Cache-Control: no-store`.
- In DevTools → Network, block the URL pattern `*aadhaar*` and reload the page. Both card images fail, exactly one extra `GET /admin/artists/{id}` follows, and nothing loops.

- [ ] **Step 7: Commit**

```bash
git add src/lib/types.ts src/features/artists/queries.ts src/features/artists/ArtistReviewPage.tsx src/App.test.tsx
git commit -m "feat(admin): Identity (Aadhaar) card with logged Reveal on artist review

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Self-review notes (Part 1)

- **Spec coverage:** §1.1 → B3 (tables, migration); §1.2 → B1; §1.3 → B1; §1.4 → B2; §1.5 → B3; §1.6 → B4; §1.7 → tests in B1 to B4. §5 operations → the `.env.example` note in B1.
- **Consistency:**
  - `is_valid_aadhaar`, `encrypt_aadhaar`/`decrypt_aadhaar` and `mask_aadhaar_last4` are defined in B1 and used in B3 and B4.
  - `private_url(key, expires_in=300)` and `delete(key, private=False)` are defined in B2 and used in B3 and B4.
  - `ArtistKyc` and `AadhaarReveal` are defined in B3 and used in B4.
  - `complete_profile(..., kyc=True)` and `add_kyc` are defined in B3 and used in B3 and B4 tests.
  - The test number `234123412346` → last 4 `2346` is used consistently.
- **Known edits to existing tests:**
  - `test_submit_lists_what_is_missing` gains `"kyc"`;
  - the `EXPECTED_TABLES` and `TABLES` lists grow;
  - `complete_profile` adds KYC by default, so existing submit flows still pass.

## Self-review notes (Part 2)

- **Spec coverage:**
  - §2.1: the 4 steps and "4 short steps", `steps={4}`, Portfolio's Continue pushing Identity (and still disabled below 6), the resume rule, and "Identity & portfolio check" → M2, steps 4 and 6.
  - §2.2: the Identity screen (FormScreen 4/4, eyebrow, title and subtitle; number pad, grouping and the 12-digit cap; Verhoeff on blur and on submit; Front/Back tiles with upload, spinner, preview and Retake; the privacy note; Submit enabled when the form is complete or the details are on file; `PUT` then `POST /submit`; errors shown on the step; "Aadhaar on file •••• NNNN" with "Replace details"; handlers guard themselves) → M2, step 5.
  - §2.3: types, `saveKyc` and the mock → M1. The mock's `kyc` in `missing` → M2, step 4 (Decision 13).
  - §2.3 tests:
    - an invalid number shows the error → `Identity: groups the number…`;
    - uploading both sides and submitting reaches In review → the Portfolio test and `submitFor`;
    - resuming after a quit lands on Identity → `quitting on Identity resumes there…`;
    - Edit and resubmit shows "on file" and doesn't re-send the details → the rejection test;
    - Replace details needs all three fields again → `Replace details after a rejection…`;
    - the existing tests are updated for 4 steps → M2, step 2.1.
- **Consistency:**
  - `isValidAadhaar` and `formatAadhaar` are defined in M1 and used by the mock (M1) and the Identity screen (M2).
  - `KycInput` and `saveKyc` are defined in M1 and used in M2.
  - `ArtistProfile.kyc` is defined in M1. It is read by `identity.tsx`, and the routing fixture sets it.
  - `ResumeStep 'identity'` and the route `/artist/onboarding/identity` are both added in M2, so `artistHref` never points at a missing screen.
  - The tile labels `Add/Uploading/Retake {front|back} of card`, the field label `Aadhaar number`, and the copy strings are identical in `identity.tsx` and the tests.
  - The test numbers are consistent: `234123412346` → `2346` (also the seeded artist), and `498765432102` → `2102`.
- **Known edits to existing tests:**
  - `artist-onboarding.test.tsx`: "Step N of 3" becomes "of 4", "3 short steps" becomes "4"; the Portfolio test continues through Identity; `submitFor` goes through Identity; the rejection test resubmits from the on-file view and asserts that no `PUT /kyc` is sent.
  - `mock-artist.test.ts`: `complete()` adds kyc; the draft test expects `kyc: null`; the seeded test expects kyc; `missing` gains `'kyc'` (in M2).
  - `routing.test.ts`: the fixture gains `kyc: null` (M1), and gains identity assertions (M2).
  - `auth-flow.test.tsx`: unchanged, because its "of 3" checks are the auth progress bar.
- **Not in Part 2 (spec scope):**
  - The backend's `KycIn.aadhaar_number` `max_length=20` produces FastAPI's `{detail}` shape rather than `{code, message}`. The app can't reach it, because it sends at most 12 digits.
  - The mock doesn't delete replaced card files, because it has no storage to delete from.

## Self-review notes (Part 3)

- **Spec coverage:**
  - §3.1: the "Identity (Aadhaar)" card at the top of the main column, above Services → A1 step 4.4 (`IdentityCard` first in the `space-y-6` column).
  - The masked number with Reveal, shown only while on the page and never cached → `revealAadhaar` (step 3) held in `IdentityCard` state (step 4.7), keyed by artist id (Decisions 15 and 16).
  - "Reveals are logged." → step 4.7.
  - Front and back side by side, opening full size in the existing image dialog → the `grid-cols-2` buttons and the shared `Viewing` dialog (steps 4.2–4.6, Decision 17).
  - Refetch once on `onError` → the `refreshed` ref and `onExpired={() => void artist.refetch()}` (Decision 18).
  - "No Aadhaar on file" for `kyc: null`, with Approve not blocked → step 4.7. The header buttons don't read `kyc`.
  - Approve, Reject and the queue are unchanged → `ArtistQueuePage.tsx` and `useReviewArtist` are not touched.
- **§3.2 tests:**
  - masked number and both images → `shows the masked Aadhaar above Services…` (it also checks the order and the dialog);
  - Reveal shows the full number via `POST` to the reveal URL → `Reveal POSTs to the reveal endpoint…` (it also checks that neither cache holds the number);
  - "No Aadhaar on file" → `says "No Aadhaar on file"…` (Approve still works);
  - the expired-image single refetch (cheap, so included) → `refetches the detail once…`.
- **Consistency:**
  - `AdminKyc` matches backend `AdminKycOut` field for field, and `{ aadhaar_number }` matches `RevealOut`.
  - The reveal path `/admin/artists/${id}/kyc/reveal` is the same in `queries.ts`, the fake route and the test assertion.
  - The labels (`Identity (Aadhaar)`, `Reveal`, `Aadhaar front/back`, `Open Aadhaar front/back`) are identical in the component and the tests (Decision 19).
  - The test number `234123412346` → `•••• •••• 2346` / `2341 2341 2346` matches Parts 1 and 2.
- **Known edits to existing code and tests:**
  - The image dialog's state changes from `Photo` to `Viewing`; portfolio photos still open `full_url`, and the title is still "Portfolio photo".
  - The `artist()` fixture gains `kyc: KYC`; the six existing tests pass unchanged.
- **Verified before writing:** steps 1–5 were run in a scratch copy of `admin/`. Red: 4 failed, 6 passed. Green: 10 passed, `tsc -b` clean, and oxlint showing only the 3 pre-existing warnings.
