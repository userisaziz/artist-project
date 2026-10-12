# Increment 3: Artist Verification (Aadhaar) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Artists submit their Aadhaar number and photos of the card's front and back as onboarding step 4. Admins see the photos and a masked number (with a logged Reveal) on the existing review page.

**Architecture:** The backend encrypts the number with Fernet, using a key from `.env`, and keeps only the last 4 digits in plain text. It stores the card photos as Cloudinary *private* images and serves them through 5-minute signed download links, all behind the existing `ImageStorage` seam. Identity data lives in its own `artist_kyc` table, and admin reveals are recorded in `aadhaar_reveals`. Mobile adds an Identity step; admin adds an Identity card.

**Tech Stack:** FastAPI, SQLAlchemy 2 async, Alembic, pytest (real Postgres test DB), `cryptography` (Fernet); Expo/React Native (Part 2); React + Vite + shadcn/ui (Part 3).

**Spec:** `docs/superpowers/specs/2026-10-12-artist-verification-aadhaar-design.md`

**Delivery in parts.** You asked to be kept involved at each stage, so the plan comes in three parts:
- **Part 1 (backend)** is written in full below.
- **Part 2 (mobile)** and **Part 3 (admin)** are written after the backend is built and reviewed. They then target the API as it actually ships, and you see each stage's result before the next one is planned.

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

## Part 2 (mobile) and Part 3 (admin)

These are written after Part 1 is built and reviewed, against the API as it ships. Their scope is fixed by spec §2 and §3:

- **Part 2 (mobile):**
  - types (`kyc`, `'aadhaar'` purpose, `KycInput`), `saveKyc`, and the mock mirroring §1.5 (the seeded artist gets kyc);
  - `src/artist/aadhaar.ts` (Verhoeff);
  - the Identity screen with its on-file / "Replace details" state;
  - 4-step progress, the Portfolio "Continue" button, the `identity` resume step, and the In review copy "Identity & portfolio check";
  - tests.
- **Part 3 (admin):**
  - the Identity (Aadhaar) card, with the masked number, a Reveal button that isn't cached, front and back images in the existing dialog, a one-time refetch when an image link has expired, and the "No Aadhaar on file" state;
  - Vitest tests.

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
