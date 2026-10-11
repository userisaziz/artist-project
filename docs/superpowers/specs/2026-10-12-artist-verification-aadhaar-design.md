# Increment 3: Artist verification (Aadhaar)

Date: 2026-10-12 · Status: approved in brainstorming, awaiting written-spec review

## Goal

Before an artist's profile goes to review, the artist proves who they are. They type their Aadhaar number and upload photos of the front and back of the card. The admin sees both photos next to the number on the existing review page, and then approves or rejects as today.

## Decisions (made with the product owner, 2026-10-12)

| Decision | Choice |
|---|---|
| What is collected | The Aadhaar number (typed) and photos of the card's front and back. No selfie, no bank details. |
| Number storage | **The full number, encrypted** in the app layer (Fernet). The last 4 digits are kept in plain text for masked display. |
| Photo storage | Cloudinary **private** images (no public URL). Admins get download links that expire after 5 minutes. |
| Where it lives | A separate `artist_kyc` table, one row per artist profile. |
| Where in the flow | A new **step 4 of 4** in onboarding (Profile → Services → Portfolio → Identity → Submit). One submission and one admin review. |
| Admin tools | See both photos and the number (masked, with a logged **Reveal**). No checklist, internal notes or "Request info". Approve and Reject are unchanged. |

**Compliance note (accepted risk).** UIDAI guidance (Aadhaar Act §29 and the Aadhaar Regulations) limits who may store full Aadhaar numbers, and recommends masked Aadhaar for entities that are not licensed KYC agencies. The product owner chose full-number storage. This design reduces exposure as follows:
- The number is encrypted at rest, and the key lives outside the database.
- It is shown masked everywhere by default.
- Revealing the full number is an admin-only action, and each reveal is logged.
- The artist's own API responses never contain the full number or the photos.

Legal review is recommended before launch.

## Out of scope

- Selfie and liveness checks, face match, automated eKYC (DigiLocker or a UIDAI API), bank or penny-drop checks.
- An admin checklist, internal notes, or a "Request info" action.
- Purging or retention of KYC data after approval.
- Detecting duplicate Aadhaar numbers across accounts.
- Editing after approval.

## 1. Backend

### 1.1 Data (Alembic migration #5)

- **`artist_kyc`**
  - `artist_id`: primary key; foreign key to `artist_profiles.id`, `ON DELETE CASCADE`
  - `aadhaar_encrypted`: text, a Fernet token
  - `aadhaar_last4`: char(4)
  - `front_key`, `back_key`: varchar(255), storage keys
  - `created_at`, `updated_at`
- **`aadhaar_reveals`**
  - `id`
  - `artist_id`: foreign key to `artist_profiles.id`, `ON DELETE CASCADE`
  - `admin_id`: foreign key to `users.id`
  - `revealed_at`

### 1.2 Encryption (`app/core/crypto.py`)

- `encrypt_aadhaar(number) -> str` and `decrypt_aadhaar(token) -> str` use `cryptography.fernet.Fernet`.
- The key comes from the setting `AADHAAR_ENCRYPTION_KEY`: a 32-byte url-safe base64 Fernet key.
- The app refuses to start if the key is missing or invalid. Tests use a fixed test key.
- `.env.example` documents how to generate one:

  ```
  python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
  ```

- New dependency: `cryptography`, pinned in `requirements.txt`.

### 1.3 Validation (`app/utils/aadhaar.py`)

`is_valid_aadhaar(number)` returns true only when the number:
- is exactly 12 digits;
- does not start with 0 or 1;
- passes the Verhoeff checksum.

The schema strips spaces before validating. An invalid number returns `422 validation_error` with the message "Invalid Aadhaar number".

### 1.4 Storage (`app/services/storage.py`)

- `Purpose` gains `"aadhaar"`. Keys look like `artists/{user_id}/aadhaar/{hex20}`, using the same `new_key` and `owns` helpers.
- **`CloudinaryStorage`**
  - `upload_params(..., "aadhaar")` adds `type=private` to the signed form, so `type` is included in the signature.
  - New `private_url(key, expires_in=300)` returns a signed private-download URL:
    `https://api.cloudinary.com/v1_1/{cloud}/image/download?public_id=…&format=jpg&type=private&timestamp=…&expires_at=…&api_key=…&signature=…`
  - `delete(key, private=True)` destroys the image with `type=private`.
- **`FakeStorage`**
  - `private_url` returns `https://fake.storage/private/{key}.jpg?expires_at=…`.
  - `delete` records the key, as today.
- `url()` (public) is never used for Aadhaar keys.

### 1.5 Artist API

**`PUT /api/v1/artists/me/kyc`**
- Requires `role = artist`. Body: `{aadhaar_number, front_key, back_key}`. All three are required on every call ("Replace details" re-sends everything).
- Checks, in order:
  1. A profile exists, else `404 not_found`.
  2. The profile is editable (`draft` or `rejected`), else `409 conflict`.
  3. The number is valid, else `422`.
  4. Both keys belong to the caller and have purpose `aadhaar`, else `422 "Invalid photo key"`.
  5. `front_key` and `back_key` differ, else `422`.
- Upserts the `artist_kyc` row. When a replaced key changes, the old private file is deleted.
- Returns the full `ArtistProfileOut`.

**`ArtistProfileOut` changes**
- Gains `kyc: {aadhaar_last4: str} | null`.
- The full number, the keys and any URL are never returned to the artist.

**`POST /api/v1/artists/me/submit` changes**
- The completeness check adds `"kyc"` to `missing` when there is no `artist_kyc` row. It is ordered after `"portfolio"`.

### 1.6 Admin API

**`GET /api/v1/admin/artists/{id}` changes**
- `AdminArtistDetail` gains:

  ```
  kyc: { aadhaar_masked: "•••• •••• 4412", front_url, back_url } | null
  ```

- `front_url` and `back_url` are fresh `private_url`s, valid for 5 minutes.

**New `POST /api/v1/admin/artists/{id}/kyc/reveal`**
- Requires `role = admin`.
- Returns `404 not_found` if the profile has no KYC row.
- Decrypts the number, inserts an `aadhaar_reveals` row, and returns `{aadhaar_number: "123456789012"}`.
- Responses carry `Cache-Control: no-store`.

### 1.7 Tests (pytest, real test DB, FakeStorage)

- Verhoeff: known-valid and known-invalid numbers, numbers with a leading 0 or 1, wrong lengths, non-digits.
- Encrypt and decrypt round trip; the encrypted value never contains the plain number.
- `PUT /kyc`:
  - happy path;
  - an invalid number;
  - someone else's key, or a key with the wrong purpose;
  - the same key for front and back;
  - `409` when the profile is `pending`;
  - replacing deletes the old file.
- `GET /artists/me` never leaks the number, keys or URLs.
- Submit lists `"kyc"` as missing.
- Admin detail has a masked number and two private URLs. Reveal returns the full number and writes an audit row. A non-admin gets `403`. Reveal with no KYC returns `404`.

## 2. Mobile app (artist)

### 2.1 Flow

- Onboarding has **4 steps**. The Intro copy becomes "4 short steps".
- Step-progress bars show `steps={4}`: Profile 1/4, Services 2/4, Portfolio 3/4, Identity 4/4.
- **Portfolio:**
  - With 6 or more photos, the button reads **"Continue"** and pushes `/artist/onboarding/identity`.
  - Below 6, it reads "Continue · n of 6 photos" and stays disabled, as today.
  - Submit moves off this screen.
- **Resume rule** (`resumeStep`): no profile → `intro`; no services → `services`; fewer than 6 photos → `portfolio`; no `kyc` → `identity`; otherwise `identity`, so the artist can submit.
- **In review timeline:** the middle milestone becomes "Identity & portfolio check".

### 2.2 Identity screen (`app/artist/onboarding/identity.tsx`)

- Uses `FormScreen` with step 4 of 4, eyebrow "STEP 4 · IDENTITY", and title "Confirm it's" with the accent word "you".
- Subtitle: "We use your Aadhaar only to verify your identity."
- **Aadhaar number field:**
  - number pad;
  - grouped display `1234 5678 9012`;
  - a maximum of 12 digits.
- **Validation:**
  - Uses the same Verhoeff check as the server (`src/artist/aadhaar.ts`).
  - Runs on blur and on submit.
  - Error message: "That doesn't look like a valid Aadhaar number."
- **Front and Back tiles:**
  - Tapping a tile picks one photo, shrinks it, and uploads it with `uploadImage(image, 'aadhaar')`.
  - While uploading, the tile shows a spinner.
  - Once uploaded, it shows a preview from the local URI, with a "Retake" option.
- Privacy note: "Your Aadhaar is encrypted and only seen by our verification team."
- **"Submit for review"**
  - It is enabled when the number is valid and both photos are uploaded, or when details are already on file and unchanged.
  - It runs `PUT /artists/me/kyc` (skipped when unchanged), then `POST /artists/me/submit`.
  - On failure, it shows the error on the screen. The artist stays on the step.
  - On success, the guard flips the app to In review.
- **Details already on file** (the app never receives the number or the photos back):
  - The screen shows "Aadhaar on file •••• 4412" with a **"Replace details"** link.
  - "Replace details" opens the empty form, and all three fields are required again.
- Like the other steps, the handler guards inside itself (disabled buttons still fire `onPress` under RNTL).

### 2.3 Supporting changes

- **Types:** `ArtistProfile.kyc: {aadhaar_last4: string} | null`; `UploadPurpose` adds `'aadhaar'`; `KycInput {aadhaar_number, front_key, back_key}`.
- **Endpoint:** `saveKyc(KycInput)` calls `PUT /artists/me/kyc`.
- **Mock transport:** mirrors §1.5. It has the `aadhaar` upload purpose, a Verhoeff check, the editable rule, `kyc` in `missing`, and stores only the last 4 digits plus the keys. The seeded approved artist gets a `kyc` record.
- **Tests** (jest-expo against the mock):
  - an invalid number shows the error;
  - uploading front and back then submitting reaches In review;
  - resuming after a quit lands on Identity;
  - after a rejection, Edit and resubmit shows "Aadhaar on file •••• NNNN" and resubmits without replacing;
  - Replace details requires all three fields again;
  - the existing flow tests are updated for 4 steps.

## 3. Admin panel

### 3.1 Artist review page (`ArtistReviewPage.tsx`)

- A new **"Identity (Aadhaar)"** card goes at the top of the main column, above Services.
  - **Number:** shown masked as `•••• •••• 4412`, with a **Reveal** button.
    - Reveal calls the reveal endpoint and shows the full number while the admin stays on the page. Nothing is stored in the query cache or anywhere on the client.
    - A caption under it reads "Reveals are logged."
  - **Front and Back:** two images side by side. Clicking one opens it full size in the existing image dialog.
    - On an image `onError` (the 5-minute link has expired), the page refetches the artist detail once to get fresh links.
  - **No KYC row:** the card says "No Aadhaar on file". This happens for artists who submitted before this increment. Approve is not blocked.
- Approve, Reject and the queue are unchanged.

### 3.2 Tests (Vitest + Testing Library, mocked fetch)

- The masked number and both images render.
- Reveal shows the full number, and the call is a `POST` to the reveal URL.
- "No Aadhaar on file" shows when `kyc` is null.

## 4. Build sequence

Each stage is reviewed before the next, and progress is reported to the product owner after each.

1. **Backend:** migration, crypto, Verhoeff, storage `aadhaar` purpose and private URLs, endpoints, tests.
2. **Mobile:** types, mock, endpoint, then the Identity screen, the flow changes (4 steps, Portfolio Continue, resume rule, In review copy), and tests.
3. **Admin:** the Identity card, Reveal, the expired-link refresh, and tests.

## 5. Operations

- Add `AADHAAR_ENCRYPTION_KEY` to every environment.
- **Losing the key makes every stored number unrecoverable.** Back it up in a secrets manager.
- Rotating the key is out of scope. Fernet's `MultiFernet` allows it later.
- Cloudinary private delivery needs no plan upgrade. Signed download URLs with `expires_at` are available on all plans.
