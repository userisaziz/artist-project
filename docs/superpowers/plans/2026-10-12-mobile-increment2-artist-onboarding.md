# Mobile Increment 2: Artist Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An artist who picked "Create your profile" on Choose role builds a profile (photo, business name, categories, city), adds services, uploads at least six portfolio photos, submits, and then sees In review (or the rejection reason, with Edit and resubmit). An approved artist lands on the existing artist home.

**Architecture:** The artist area (`app/artist/`) gets its own redirect hub (`app/artist/index.tsx`) and three guarded areas (onboarding, in review, home), mirroring how the root gate works. The guards and the hub both read one pure function, `artistHref()`, applied to the cached `GET /artists/me` profile (TanStack Query). Every artist write returns the whole profile, and the client puts it straight into the query cache, so the guards re-route with no extra fetches. The mock transport implements the full artist contract with the same rules as `backend/app/services/artist_service.py`, so the app and the tests run without a backend.

**Tech Stack:** Expo SDK 57, Expo Router 57 (`Stack.Protected`, `router.dismissTo`), React Native 0.86, TypeScript, `@tanstack/react-query` v5, `expo-image-picker`, `expo-image-manipulator`, jest-expo with `expo-router/testing-library`.

**Spec:** `docs/superpowers/specs/2026-10-10-increment2-artist-onboarding-design.md` (§2 upload flow, §3 API contract, §4 mobile screens, §6 mobile tests). The backend side is already built: `backend/app/api/v1/artists.py`, `uploads.py`, `catalog.py`, `backend/app/schemas/artist.py`, `backend/app/services/artist_service.py`.

**Design reference:** `docs/design/atelier/Atelier Hi-fi Prototype.dc.html`, lines 556–625 (`onbIntro`, `onbProfile`, `onbPortfolio`, `onbDone`). The Services step isn't drawn; it follows the Profile step's style.

## Global Constraints

- All API paths are under `/api/v1`. Artist endpoints are `/artists/me…`. Catalog endpoints are `/categories` and `/cities` (no prefix, no auth). The upload endpoint is `/uploads/signature`.
- Every artist write returns the full `ArtistProfileOut`. `GET /artists/me` returns `404 not_found` before the first Profile save.
- Writes are allowed only in `draft` or `rejected`. Otherwise the server returns `409 conflict`.
- Submit needs a photo, at least one category, at least one service and **at least 6 portfolio photos** (`MIN_PHOTOS = 6`). The portfolio holds at most **30** (`MAX_PHOTOS = 30`). A failed submit returns `422 validation_error` with `missing: string[]` and `min_photos`.
- `ProfileIn` has `business_name` (1–120 characters), `city` (from the fixed list), `category_ids` (1–6), `photo_key?` and `bio?`.
- `ServiceIn` has `category_id`, `name` (1–120 characters), `price_paise` (> 0, ≤ 100 000 000), `duration_minutes` (> 0, ≤ 1440) and `description?`.
- Cities: `Bangalore`, `Mumbai`, `Delhi NCR`, `Hyderabad`, `Chennai`, `Pune`.
- Upload: shrink on device so the longest side is ≤ **2048 px**, as JPEG at quality **0.8**. Then `POST /uploads/signature {purpose: "artist_photo" | "portfolio"}`, POST the form `fields` plus the file (form field `file`) to `upload_url`, and send `key` to our API. Keys live under `artists/{user_id}/{purpose}/`.
- Screens switch on `ApiError.code`, never on status (`src/api/error-message.ts`).
- Copy: the Intro says "3 short steps" and drops "Get paid securely, every Monday". The Portfolio button reads `Continue · n of 6 photos` until there are six. Reordering is "Make cover" only.
- Style: match the existing Atelier screens (`FormScreen`, `FormHeading`, `AppTextField`, `FieldHalo`, `AppButton`, theme tokens; no hard-coded hex values).
- Run every command from `mobile/`. `.env.test` sets `EXPO_PUBLIC_USE_MOCKS=true`, so jest always uses `MockTransport`.

## Decisions this plan makes (the spec leaves them open)

1. **A rejected profile goes to In review first**, which shows the reason and "Edit and resubmit". Pressing it switches the artist area to onboarding at the Profile step. Spec §4 lists rejected under both routing and the In review screen; this reconciles the two.
2. **The artist area gets its own redirect hub.** `/artist` (`app/artist/index.tsx`) becomes a redirect hub like `/`, and the placeholder home moves to `/artist/home`. The root `landingHref('artist')` stays `/artist`.
3. **Upload progress is a spinner per tile.** `fetch` has no upload progress events; real percentages would need `XMLHttpRequest`, which can come later.
4. **Long-pressing a portfolio tile selects it**, which shows "Make cover" and "Remove". The spec says long-press removes; this adds "Make cover" to the same gesture so there is one interaction, and it works on web.
5. **Services can be added and removed, not edited.** The backend `PATCH` exists, but the UI doesn't need it in this increment.
6. **Against a real backend running `STORAGE_PROVIDER=fake`**, the uploader skips the storage POST (its `upload_url` is `https://fake.storage/upload`, which doesn't exist). Images then show broken URLs in dev, which is expected. In the mock transport, the uploader registers the local file URI so the picked images render.
7. **Copy trims.** The Intro's second line drops "dates and travel area" (out of scope this increment). The Portfolio tip drops the unsupported "3×" claim.

## File structure

| File | Responsibility |
|---|---|
| `src/api/transport.ts` (modify) | Allow `GET` and `DELETE` |
| `src/api/client.ts` (modify) | `request()` accepts every transport method |
| `src/api/types.ts` (modify) | Artist, catalog and upload contract types |
| `src/api/endpoints/artist.ts` (create) | `/artists/me…` and `/uploads/signature` calls |
| `src/api/endpoints/catalog.ts` (create) | `/categories`, `/cities` |
| `src/api/mock/artist.ts` (create) | Mock artist contract (rules mirror `artist_service.py`) |
| `src/api/mock/transport.ts` (modify) | Route catalog/artist/upload paths to the mock artist module; seed the demo artist as approved; `review()` test helper |
| `src/api/query-client.ts` (create) | The app's `QueryClient` and the AppState → `focusManager` wiring |
| `src/artist/routing.ts` (create) | `artistStage()`, `resumeStep()`, `artistHref()` (pure) |
| `src/artist/flow-context.tsx` (create) | The `editing` flag ("Edit and resubmit") shared by the artist layout and its screens |
| `src/artist/queries.ts` (create) | `useArtistProfile`, `useArtistWrite`, `useCategories`, `useCities` |
| `src/artist/upload.ts` (create) | `pickImages`, `uploadImage`, `postToStorage` |
| `src/artist/format.ts` (create) | `formatPrice`, `formatDuration` |
| `src/components/FormScreen.tsx` (modify) | Optional `steps` count (default 3) |
| `src/components/Chip.tsx` (create) | Selectable pill (categories) |
| `src/artist/CityField.tsx` (create) | City field plus a picker sheet |
| `src/artist/AddServiceSheet.tsx` (create) | The "Add service" bottom sheet |
| `app/_layout.tsx` (modify) | `QueryClientProvider` |
| `src/auth/auth-provider.tsx` (modify) | Clear the query cache on sign-out |
| `app/artist/_layout.tsx` (rewrite) | Load the profile and guard onboarding, in-review and home |
| `app/artist/index.tsx` (rewrite) | Artist redirect hub |
| `app/artist/home.tsx` (moved from `index.tsx`) | Approved home (the old placeholder) |
| `app/artist/in-review.tsx` (create) | Pending timeline, or the rejection reason with Edit and resubmit |
| `app/artist/onboarding/_layout.tsx` (create) | Plain stack for the four steps |
| `app/artist/onboarding/intro.tsx`, `profile.tsx`, `services.tsx`, `portfolio.tsx` (create) | The steps |
| Tests | `src/api/__tests__/mock-artist.test.ts`, `src/artist/__tests__/{routing,upload,format}.test.ts`, `src/__tests__/artist-onboarding.test.tsx`, an update to `src/__tests__/auth-flow.test.tsx` |

---

### Task 1: API contract types, GET/DELETE transport, and the mock artist contract

**Files:**
- Modify: `src/api/transport.ts`
- Modify: `src/api/client.ts`
- Modify: `src/api/types.ts`
- Create: `src/api/mock/artist.ts`
- Modify: `src/api/mock/transport.ts`
- Test: `src/api/__tests__/mock-artist.test.ts`

**Interfaces:**
- Produces: the types `ArtistStatus`, `Category`, `ServiceItem`, `PortfolioPhoto`, `ArtistProfile`, `ProfileInput`, `ServiceInput`, `PhotoInput`, `UploadPurpose` and `UploadTicket` from `src/api/types.ts`. `TransportRequest['method']` now includes `'GET' | 'DELETE'`. `MockTransport` gains `files: Map<string, string>` (storage key → local URI) and `review(phone, decision, reason?)`.

- [ ] **Step 1: Widen the transport methods**

`src/api/transport.ts`, replace the `method` line:

```ts
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
```

`src/api/client.ts`: replace `import type { Transport } from './transport';` with:

```ts
import type { Transport, TransportRequest } from './transport';
```

and change the `request` signature:

```ts
export async function request<T>(path: string, body?: unknown, opts: { auth?: boolean; method?: TransportRequest['method'] } = {}): Promise<T> {
```

- [ ] **Step 2: Add the contract types**

Insert into `src/api/types.ts`, above `ApiError`:

```ts
// ---- Artist onboarding (backend schemas/artist.py) ----

export type ArtistStatus = 'draft' | 'pending' | 'approved' | 'rejected';

export interface Category {
  id: number;
  slug: string;
  name: string;
}

/** One bookable service on the artist's menu. Prices are integer paise (₹1 = 100). */
export interface ServiceItem {
  id: string;
  category_id: number;
  name: string;
  price_paise: number;
  duration_minutes: number;
  description: string | null;
}

/** Image URLs are built by the server from the storage key; the app never builds storage URLs. */
export interface PortfolioPhoto {
  id: string;
  key: string;
  width: number;
  height: number;
  thumb_url: string;
  card_url: string;
  full_url: string;
}

export interface ArtistProfile {
  id: string;
  status: ArtistStatus;
  business_name: string;
  city: string;
  bio: string | null;
  photo_key: string | null;
  photo_url: string | null;
  categories: Category[];
  services: ServiceItem[];
  photos: PortfolioPhoto[]; // first = cover
  rejection_reason: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
}

export interface ProfileInput {
  business_name: string;
  city: string;
  category_ids: number[];
  photo_key: string | null;
  bio?: string | null;
}

export interface ServiceInput {
  category_id: number;
  name: string;
  price_paise: number;
  duration_minutes: number;
  description?: string | null;
}

export interface PhotoInput {
  key: string;
  width: number;
  height: number;
}

export type UploadPurpose = 'artist_photo' | 'portfolio';

/** POST `fields` plus the image (form field `file`) to `upload_url`, then send `key` to our API. */
export interface UploadTicket {
  upload_url: string;
  fields: Record<string, string>;
  key: string;
}
```

- [ ] **Step 3: Write the failing mock-contract tests**

Create `src/api/__tests__/mock-artist.test.ts`:

```ts
import { MockTransport } from '../mock/transport';
import type { ArtistProfile, UploadTicket } from '../types';

let logSpy: jest.SpyInstance;
beforeEach(() => { logSpy = jest.spyOn(console, 'log').mockImplementation(() => {}); });
afterEach(() => { logSpy.mockRestore(); });

/** Signs a phone in and returns the Bearer header. */
async function signIn(t: MockTransport, phone: string) {
  let code = '';
  t.onOtpGenerated = (_p, c) => { code = c; };
  await t.request({ method: 'POST', path: '/auth/otp/request', body: { phone } });
  const res = await t.request({ method: 'POST', path: '/auth/otp/verify', body: { phone, code } });
  return { Authorization: `Bearer ${(res.json as { access_token: string }).access_token}` };
}

/** A fresh user who chose the artist role. */
async function artist(t: MockTransport, phone = '+15550004444') {
  const auth = await signIn(t, phone);
  await t.request({ method: 'PUT', path: '/users/me/role', headers: auth, body: { role: 'artist' } });
  return auth;
}

async function ticket(t: MockTransport, auth: Record<string, string>, purpose: 'artist_photo' | 'portfolio') {
  const res = await t.request({ method: 'POST', path: '/uploads/signature', headers: auth, body: { purpose } });
  return res.json as UploadTicket;
}

async function draft(t: MockTransport, auth: Record<string, string>) {
  const photo = await ticket(t, auth, 'artist_photo');
  return t.request({ method: 'PUT', path: '/artists/me/profile', headers: auth, body: { business_name: ' Ayesha Mehendi Art ', city: 'Bangalore', category_ids: [1], photo_key: photo.key } });
}

/** Draft + one service + six photos: ready to submit. */
async function complete(t: MockTransport, auth: Record<string, string>) {
  await draft(t, auth);
  await t.request({ method: 'POST', path: '/artists/me/services', headers: auth, body: { category_id: 1, name: 'Bridal', price_paise: 100, duration_minutes: 60 } });
  for (let i = 0; i < 6; i++) {
    const tk = await ticket(t, auth, 'portfolio');
    await t.request({ method: 'POST', path: '/artists/me/photos', headers: auth, body: { key: tk.key, width: 10, height: 10 } });
  }
}

it('serves the catalog without auth', async () => {
  const t = new MockTransport();
  const cats = await t.request({ method: 'GET', path: '/categories' });
  expect((cats.json as { name: string }[]).map((c) => c.name)).toEqual(['Mehendi', 'Makeup', 'Hair', 'Photography', 'Decor', 'Tattoo']);
  const cities = await t.request({ method: 'GET', path: '/cities' });
  expect(cities.json).toEqual(['Bangalore', 'Mumbai', 'Delhi NCR', 'Hyderabad', 'Chennai', 'Pune']);
});

it('GET /artists/me is 404 before the first save, and artist routes refuse customers (403)', async () => {
  const t = new MockTransport();
  const auth = await artist(t);
  expect(await t.request({ method: 'GET', path: '/artists/me', headers: auth })).toMatchObject({ status: 404, json: { code: 'not_found' } });
  const customer = await signIn(t, '+15550005555');
  expect(await t.request({ method: 'GET', path: '/artists/me', headers: customer })).toMatchObject({ status: 403, json: { code: 'forbidden' } });
});

it('upload tickets are scoped to the caller and purpose', async () => {
  const t = new MockTransport();
  const auth = await artist(t);
  const tk = await ticket(t, auth, 'portfolio');
  expect(tk.upload_url).toBe('mock://upload');
  expect(tk.key).toMatch(/^artists\/[^/]+\/portfolio\/\d+$/);
});

it('PUT /artists/me/profile creates a trimmed draft and validates city, categories and photo key', async () => {
  const t = new MockTransport();
  const auth = await artist(t);
  const res = await draft(t, auth);
  expect(res.status).toBe(200);
  expect(res.json).toMatchObject({ status: 'draft', business_name: 'Ayesha Mehendi Art', city: 'Bangalore', categories: [{ id: 1, name: 'Mehendi' }], services: [], photos: [] });
  expect((res.json as ArtistProfile).photo_url).toBeTruthy();

  const base = { business_name: 'X', city: 'Bangalore', category_ids: [1], photo_key: null };
  expect(await t.request({ method: 'PUT', path: '/artists/me/profile', headers: auth, body: { ...base, city: 'Paris' } })).toMatchObject({ status: 422 });
  expect(await t.request({ method: 'PUT', path: '/artists/me/profile', headers: auth, body: { ...base, category_ids: [] } })).toMatchObject({ status: 422 });
  expect(await t.request({ method: 'PUT', path: '/artists/me/profile', headers: auth, body: { ...base, category_ids: [99] } })).toMatchObject({ status: 422 });
  expect(await t.request({ method: 'PUT', path: '/artists/me/profile', headers: auth, body: { ...base, photo_key: 'artists/someone-else/artist_photo/1' } })).toMatchObject({ status: 422 });
});

it('services: add (201), validate price and duration, delete', async () => {
  const t = new MockTransport();
  const auth = await artist(t);
  await draft(t, auth);
  const added = await t.request({ method: 'POST', path: '/artists/me/services', headers: auth, body: { category_id: 1, name: 'Bridal mehendi', price_paise: 450000, duration_minutes: 180 } });
  expect(added.status).toBe(201);
  const svc = (added.json as ArtistProfile).services[0];
  expect(svc).toMatchObject({ name: 'Bridal mehendi', price_paise: 450000, duration_minutes: 180, description: null });
  expect(await t.request({ method: 'POST', path: '/artists/me/services', headers: auth, body: { category_id: 1, name: 'X', price_paise: 0, duration_minutes: 30 } })).toMatchObject({ status: 422 });
  expect(await t.request({ method: 'POST', path: '/artists/me/services', headers: auth, body: { category_id: 1, name: 'X', price_paise: 100, duration_minutes: 1441 } })).toMatchObject({ status: 422 });
  const removed = await t.request({ method: 'DELETE', path: `/artists/me/services/${svc.id}`, headers: auth });
  expect((removed.json as ArtistProfile).services).toEqual([]);
});

it('photos: add, reject duplicates, make cover by reorder, delete', async () => {
  const t = new MockTransport();
  const auth = await artist(t);
  await draft(t, auth);
  const a = await ticket(t, auth, 'portfolio');
  const b = await ticket(t, auth, 'portfolio');
  await t.request({ method: 'POST', path: '/artists/me/photos', headers: auth, body: { key: a.key, width: 800, height: 600 } });
  expect(await t.request({ method: 'POST', path: '/artists/me/photos', headers: auth, body: { key: a.key, width: 800, height: 600 } })).toMatchObject({ status: 409 });
  const two = await t.request({ method: 'POST', path: '/artists/me/photos', headers: auth, body: { key: b.key, width: 800, height: 600 } });
  const [first, second] = (two.json as ArtistProfile).photos;
  const reordered = await t.request({ method: 'PUT', path: '/artists/me/photos/order', headers: auth, body: { photo_ids: [second.id, first.id] } });
  expect((reordered.json as ArtistProfile).photos.map((p) => p.key)).toEqual([b.key, a.key]);
  expect(await t.request({ method: 'PUT', path: '/artists/me/photos/order', headers: auth, body: { photo_ids: [second.id] } })).toMatchObject({ status: 422 });
  const left = await t.request({ method: 'DELETE', path: `/artists/me/photos/${first.id}`, headers: auth });
  expect((left.json as ArtistProfile).photos.map((p) => p.key)).toEqual([b.key]);
});

it('a registered local file becomes the photo URL', async () => {
  const t = new MockTransport();
  const auth = await artist(t);
  await draft(t, auth);
  const tk = await ticket(t, auth, 'portfolio');
  t.files.set(tk.key, 'file:///picked.jpg');
  const res = await t.request({ method: 'POST', path: '/artists/me/photos', headers: auth, body: { key: tk.key, width: 10, height: 10 } });
  expect((res.json as ArtistProfile).photos[0].thumb_url).toBe('file:///picked.jpg');
});

it('submit lists what is missing, then moves to pending and locks edits (409)', async () => {
  const t = new MockTransport();
  const auth = await artist(t);
  await draft(t, auth);
  expect(await t.request({ method: 'POST', path: '/artists/me/submit', headers: auth })).toMatchObject({ status: 422, json: { code: 'validation_error', missing: ['services', 'portfolio'], min_photos: 6 } });

  await complete(t, auth);
  const sent = await t.request({ method: 'POST', path: '/artists/me/submit', headers: auth });
  expect(sent).toMatchObject({ status: 200, json: { status: 'pending', rejection_reason: null } });
  expect((sent.json as ArtistProfile).submitted_at).toBeTruthy();
  expect(await t.request({ method: 'POST', path: '/artists/me/services', headers: auth, body: { category_id: 1, name: 'Y', price_paise: 100, duration_minutes: 60 } })).toMatchObject({ status: 409, json: { code: 'conflict' } });
});

it('review() rejects a pending profile with a reason, which makes it editable again', async () => {
  const t = new MockTransport();
  const auth = await artist(t, '+15550006666');
  await complete(t, auth);
  await t.request({ method: 'POST', path: '/artists/me/submit', headers: auth });
  t.review('+15550006666', 'rejected', 'Photos are blurry');
  const me = await t.request({ method: 'GET', path: '/artists/me', headers: auth });
  expect(me.json).toMatchObject({ status: 'rejected', rejection_reason: 'Photos are blurry' });
  expect((await draft(t, auth)).status).toBe(200);
});

it('the seeded artist has an approved profile', async () => {
  const t = new MockTransport();
  const auth = await signIn(t, '+15550009999');
  expect(await t.request({ method: 'GET', path: '/artists/me', headers: auth })).toMatchObject({ status: 200, json: { status: 'approved' } });
});
```

- [ ] **Step 4: Run the tests to confirm they fail**

Run: `npx jest src/api/__tests__/mock-artist.test.ts`
Expected: FAIL. Responses are `404 Mock has no handler…`, and `t.files` / `t.review` don't exist.

- [ ] **Step 5: Write the mock artist module**

Create `src/api/mock/artist.ts`:

```ts
import type { ArtistProfile, ArtistStatus, Category, ServiceItem, UploadPurpose } from '../types';
import type { TransportResponse } from '../transport';

// Same rules as backend services/artist_service.py and schemas/artist.py — keep them in lockstep.
export const CITIES = ['Bangalore', 'Mumbai', 'Delhi NCR', 'Hyderabad', 'Chennai', 'Pune']; // backend settings.cities
// The backend has no categories until an admin adds them; the mock seeds the design's six.
export const CATEGORIES: Category[] = ['Mehendi', 'Makeup', 'Hair', 'Photography', 'Decor', 'Tattoo']
  .map((name, i) => ({ id: i + 1, slug: name.toLowerCase(), name }));
const MIN_PHOTOS = 6;
const MAX_PHOTOS = 30;
const EDITABLE: ArtistStatus[] = ['draft', 'rejected'];

interface MockPhoto { id: string; key: string; width: number; height: number }
interface MockProfile {
  id: string; status: ArtistStatus; business_name: string; city: string; bio: string | null;
  photo_key: string | null; category_ids: number[]; services: ServiceItem[]; photos: MockPhoto[];
  rejection_reason: string | null; submitted_at: string | null; reviewed_at: string | null;
}

const err = (code: string, message: string, status: number, extra: object = {}): TransportResponse => ({ status, json: { code, message, ...extra } });
const isInt = (v: unknown, max: number): v is number => typeof v === 'number' && Number.isInteger(v) && v > 0 && v <= max;
const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/** In-memory artist profiles for MockTransport. `files` maps storage keys to local URIs for image URLs. */
export class MockArtists {
  private profiles = new Map<string, MockProfile>(); // user id → profile
  private seq = 0;
  constructor(private files: Map<string, string>) {}

  private id(kind: string) { return `mock-${kind}-${++this.seq}`; }
  private url(key: string) { return this.files.get(key) ?? `mock://${key}`; }
  private owns(key: string, userId: string, purpose: UploadPurpose) { return key.startsWith(`artists/${userId}/${purpose}/`); }

  private out(p: MockProfile): ArtistProfile {
    return {
      id: p.id, status: p.status, business_name: p.business_name, city: p.city, bio: p.bio,
      photo_key: p.photo_key, photo_url: p.photo_key ? this.url(p.photo_key) : null,
      categories: CATEGORIES.filter((c) => p.category_ids.includes(c.id)),
      services: p.services.map((s) => ({ ...s })),
      photos: p.photos.map((ph) => ({ ...ph, thumb_url: this.url(ph.key), card_url: this.url(ph.key), full_url: this.url(ph.key) })),
      rejection_reason: p.rejection_reason, submitted_at: p.submitted_at, reviewed_at: p.reviewed_at,
    };
  }

  private ok(p: MockProfile, status = 200): TransportResponse { return { status, json: this.out(p) }; }

  uploadTicket(userId: string, purpose: unknown): TransportResponse {
    if (purpose !== 'artist_photo' && purpose !== 'portfolio') return err('validation_error', 'purpose must be artist_photo or portfolio', 422);
    return { status: 200, json: { upload_url: 'mock://upload', fields: {}, key: `artists/${userId}/${purpose}/${++this.seq}` } };
  }

  /** Routes `/artists/me…` for a signed-in artist. */
  handle(userId: string, method: string, path: string, b: Record<string, unknown>): TransportResponse {
    const p = this.profiles.get(userId);
    if (method === 'GET' && path === '/artists/me') return p ? this.ok(p) : err('not_found', 'No artist profile yet', 404);
    if (method === 'PUT' && path === '/artists/me/profile') return this.saveProfile(userId, p, b);
    if (!p) return err('not_found', 'No artist profile yet', 404);
    if (!EDITABLE.includes(p.status)) return err('conflict', `Profile is ${p.status} and can't be edited`, 409);
    const id = path.split('/').pop() ?? '';
    if (method === 'POST' && path === '/artists/me/services') return this.addService(p, b);
    if (method === 'DELETE' && path.startsWith('/artists/me/services/')) return this.remove(p, 'services', id, 'Service not found');
    if (method === 'POST' && path === '/artists/me/photos') return this.addPhoto(userId, p, b);
    if (method === 'PUT' && path === '/artists/me/photos/order') return this.reorder(p, b.photo_ids);
    if (method === 'DELETE' && path.startsWith('/artists/me/photos/')) return this.remove(p, 'photos', id, 'Photo not found');
    if (method === 'POST' && path === '/artists/me/submit') return this.submit(p);
    return err('not_found', `Mock has no handler for ${method} ${path}`, 404);
  }

  private saveProfile(userId: string, existing: MockProfile | undefined, b: Record<string, unknown>): TransportResponse {
    const name = text(b.business_name);
    if (!name || name.length > 120) return err('validation_error', 'business_name must be 1–120 characters', 422);
    if (typeof b.city !== 'string' || !CITIES.includes(b.city)) return err('validation_error', 'Unknown city', 422);
    const ids = Array.isArray(b.category_ids) ? (b.category_ids as unknown[]) : [];
    if (ids.length < 1 || ids.length > 6 || !ids.every((id) => CATEGORIES.some((c) => c.id === id))) return err('validation_error', 'Unknown category', 422);
    const photoKey = typeof b.photo_key === 'string' && b.photo_key ? b.photo_key : null;
    if (photoKey && !this.owns(photoKey, userId, 'artist_photo')) return err('validation_error', 'Invalid photo key', 422);
    if (existing && !EDITABLE.includes(existing.status)) return err('conflict', `Profile is ${existing.status} and can't be edited`, 409);
    const p: MockProfile = existing ?? {
      id: this.id('artist'), status: 'draft', business_name: '', city: '', bio: null, photo_key: null,
      category_ids: [], services: [], photos: [], rejection_reason: null, submitted_at: null, reviewed_at: null,
    };
    Object.assign(p, { business_name: name, city: b.city, category_ids: [...new Set(ids as number[])], photo_key: photoKey, bio: typeof b.bio === 'string' ? b.bio : null });
    this.profiles.set(userId, p);
    return this.ok(p);
  }

  private addService(p: MockProfile, b: Record<string, unknown>): TransportResponse {
    const name = text(b.name);
    if (!CATEGORIES.some((c) => c.id === b.category_id)) return err('validation_error', 'Unknown category', 422);
    if (!name || name.length > 120) return err('validation_error', 'name must be 1–120 characters', 422);
    if (!isInt(b.price_paise, 100_000_000)) return err('validation_error', 'price_paise must be a positive whole number', 422);
    if (!isInt(b.duration_minutes, 1440)) return err('validation_error', 'duration_minutes must be 1–1440', 422);
    p.services.push({
      id: this.id('service'), category_id: b.category_id as number, name,
      price_paise: b.price_paise, duration_minutes: b.duration_minutes,
      description: typeof b.description === 'string' ? b.description : null,
    });
    return this.ok(p, 201);
  }

  private addPhoto(userId: string, p: MockProfile, b: Record<string, unknown>): TransportResponse {
    const key = typeof b.key === 'string' ? b.key : '';
    if (!this.owns(key, userId, 'portfolio')) return err('validation_error', 'Invalid photo key', 422);
    if (p.photos.some((ph) => ph.key === key)) return err('conflict', 'Photo already added', 409);
    if (p.photos.length >= MAX_PHOTOS) return err('validation_error', `A portfolio holds at most ${MAX_PHOTOS} photos`, 422);
    if (!isInt(b.width, 20_000) || !isInt(b.height, 20_000)) return err('validation_error', 'width and height must be positive', 422);
    p.photos.push({ id: this.id('photo'), key, width: b.width, height: b.height });
    return this.ok(p, 201);
  }

  private reorder(p: MockProfile, ids: unknown): TransportResponse {
    const list = Array.isArray(ids) ? (ids as string[]) : [];
    const known = new Set(p.photos.map((ph) => ph.id));
    if (list.length !== known.size || new Set(list).size !== list.length || !list.every((id) => known.has(id))) {
      return err('validation_error', 'photo_ids must list every portfolio photo exactly once', 422);
    }
    p.photos.sort((a, b) => list.indexOf(a.id) - list.indexOf(b.id));
    return this.ok(p);
  }

  private remove(p: MockProfile, field: 'services' | 'photos', id: string, missing: string): TransportResponse {
    const i = p[field].findIndex((item) => item.id === id);
    if (i < 0) return err('not_found', missing, 404);
    p[field].splice(i, 1);
    return this.ok(p);
  }

  private submit(p: MockProfile): TransportResponse {
    const missing: string[] = [];
    if (!p.photo_key) missing.push('photo');
    if (!p.category_ids.length) missing.push('categories');
    if (!p.services.length) missing.push('services');
    if (p.photos.length < MIN_PHOTOS) missing.push('portfolio');
    if (missing.length) return err('validation_error', 'Profile is incomplete', 422, { missing, min_photos: MIN_PHOTOS });
    Object.assign(p, { status: 'pending', submitted_at: new Date().toISOString(), rejection_reason: null });
    return this.ok(p);
  }

  /** Test/dev stand-in for the admin app's approve and reject. */
  review(userId: string, decision: 'approved' | 'rejected', reason: string | null) {
    const p = this.profiles.get(userId);
    if (!p || p.status !== 'pending') throw new Error('review() needs a pending profile');
    Object.assign(p, { status: decision, rejection_reason: decision === 'rejected' ? reason : null, reviewed_at: new Date().toISOString() });
  }

  /** Demo artist (+15550009999): already approved, so the returning-artist path lands on the home. */
  seedApproved(userId: string) {
    const now = new Date().toISOString();
    this.profiles.set(userId, {
      id: this.id('artist'), status: 'approved', business_name: 'Priya Bridal Studio', city: 'Bangalore', bio: null,
      photo_key: null, category_ids: [1, 2], services: [], photos: [], rejection_reason: null, submitted_at: now, reviewed_at: now,
    });
  }
}
```

- [ ] **Step 6: Wire it into `MockTransport`**

In `src/api/mock/transport.ts`:

1. Add the import:

```ts
import { CATEGORIES, CITIES, MockArtists } from './artist';
```

2. Add fields to the class, just below `lastOtp`:

```ts
  /** Storage key → local file URI. The uploader registers picked images here so mock image URLs render them. */
  readonly files = new Map<string, string>();
  private artists = new MockArtists(this.files);
```

3. In `request()`, insert above the `ACCOUNT_ROUTES` check:

```ts
    if (method === 'GET' && path === '/categories') return ok(CATEGORIES);
    if (method === 'GET' && path === '/cities') return ok(CITIES);
    if (path === '/uploads/signature' || path.startsWith('/artists/me')) {
      const user = this.userFor(headers);
      if (!user) return err('auth_error', 'Authentication failed', 401);
      if (!user.roles.includes('artist')) return err('forbidden', 'Not allowed for this account', 403); // backend require_role: held roles, not the active side
      if (path === '/uploads/signature') return this.artists.uploadTicket(user.id, data.purpose);
      return this.artists.handle(user.id, method, path, (body ?? {}) as Record<string, unknown>);
    }
```

4. In `otpVerify`, right after `this.users.set(phone, user);` inside the `if (!user)` block:

```ts
      if (isArtistSeed) this.artists.seedApproved(user.id);
```

5. Add a public method after `advanceTime`:

```ts
  /** Admin approve/reject stand-in, keyed by phone like the rest of the mock's test hooks. */
  review(phone: string, decision: 'approved' | 'rejected', reason?: string) {
    const user = this.users.get(phone);
    if (!user) throw new Error(`No mock user ${phone}`);
    this.artists.review(user.id, decision, reason ?? null);
  }
```

- [ ] **Step 7: Run the tests to confirm they pass**

Run: `npx jest src/api/__tests__/mock-artist.test.ts src/api/__tests__/mock-transport.test.ts`
Expected: PASS (all tests, old and new).

- [ ] **Step 8: Typecheck and commit**

Run: `npx tsc --noEmit`
Expected: no errors.

```bash
git add src/api/transport.ts src/api/client.ts src/api/types.ts src/api/mock/artist.ts src/api/mock/transport.ts src/api/__tests__/mock-artist.test.ts
git commit -m "feat(mobile): artist onboarding contract types and mock artist API"
```

---

### Task 2: Endpoint functions, image upload pipeline and formatters

**Files:**
- Create: `src/api/endpoints/artist.ts`
- Create: `src/api/endpoints/catalog.ts`
- Create: `src/artist/upload.ts`
- Create: `src/artist/format.ts`
- Modify: `package.json`, `package-lock.json` (via `npx expo install`)
- Test: `src/artist/__tests__/upload.test.ts`, `src/artist/__tests__/format.test.ts`

**Interfaces:**
- Consumes: the types from Task 1 and `MockTransport.files`.
- Produces:
  - `src/api/endpoints/artist.ts`: `getMyProfile(): Promise<ArtistProfile | null>`, `saveProfile(ProfileInput)`, `addService(ServiceInput)`, `deleteService(id)`, `addPhoto(PhotoInput)`, `deletePhoto(id)`, `reorderPhotos(ids: string[])` and `submitProfile()` (all return `Promise<ArtistProfile>`), plus `uploadTicket(UploadPurpose): Promise<UploadTicket>`.
  - `src/api/endpoints/catalog.ts`: `listCategories(): Promise<Category[]>` and `listCities(): Promise<string[]>`.
  - `src/artist/upload.ts`: `PickedImage { uri; width; height }`, `pickImages(limit: number): Promise<PickedImage[]>`, `uploadImage(image, purpose): Promise<PhotoInput>` and `postToStorage(ticket, uri): Promise<void>`.
  - `src/artist/format.ts`: `formatPrice(paise)` (`'₹4,500'`) and `formatDuration(minutes)` (`'45 min'`, `'3 hr'`, `'1 hr 30 min'`).

- [ ] **Step 1: Install the libraries**

Run: `npx expo install expo-image-picker expo-image-manipulator @tanstack/react-query`
Expected: all three are added to `dependencies` at SDK-57-compatible versions.

Then confirm the manipulator's context API exists in the installed version:

Run: `grep -rn "manipulate\|renderAsync\|saveAsync" node_modules/expo-image-manipulator/build/*.d.ts | head`
Expected: `ImageManipulator.manipulate(uri)` returning a context with `resize()` and `renderAsync()`, and an image ref with `saveAsync({ compress, format })` that resolves to `{ uri, width, height }`. If the names differ, adapt `shrink()` in Step 5 to the installed API and keep its behaviour the same.

- [ ] **Step 2: Write the endpoint functions**

Create `src/api/endpoints/artist.ts`:

```ts
import { request } from '../client';
import { ApiError } from '../types';
import type { ArtistProfile, PhotoInput, ProfileInput, ServiceInput, UploadPurpose, UploadTicket } from '../types';

// Mirrors backend api/v1/artists.py + uploads.py. Every write returns the whole profile.

/** null until the first Profile save (the backend answers 404 not_found). */
export async function getMyProfile(): Promise<ArtistProfile | null> {
  try {
    return await request<ArtistProfile>('/artists/me', undefined, { auth: true, method: 'GET' });
  } catch (e) {
    if (e instanceof ApiError && e.code === 'not_found') return null;
    throw e;
  }
}
export function saveProfile(body: ProfileInput) {
  return request<ArtistProfile>('/artists/me/profile', body, { auth: true, method: 'PUT' });
}
export function addService(body: ServiceInput) {
  return request<ArtistProfile>('/artists/me/services', body, { auth: true });
}
export function deleteService(id: string) {
  return request<ArtistProfile>(`/artists/me/services/${id}`, undefined, { auth: true, method: 'DELETE' });
}
export function addPhoto(body: PhotoInput) {
  return request<ArtistProfile>('/artists/me/photos', body, { auth: true });
}
export function deletePhoto(id: string) {
  return request<ArtistProfile>(`/artists/me/photos/${id}`, undefined, { auth: true, method: 'DELETE' });
}
export function reorderPhotos(photoIds: string[]) {
  return request<ArtistProfile>('/artists/me/photos/order', { photo_ids: photoIds }, { auth: true, method: 'PUT' });
}
export function submitProfile() {
  return request<ArtistProfile>('/artists/me/submit', undefined, { auth: true });
}
export function uploadTicket(purpose: UploadPurpose) {
  return request<UploadTicket>('/uploads/signature', { purpose }, { auth: true });
}
```

Create `src/api/endpoints/catalog.ts`:

```ts
import { request } from '../client';
import type { Category } from '../types';

// Public catalog (backend api/v1/catalog.py): no auth.
export function listCategories() {
  return request<Category[]>('/categories', undefined, { method: 'GET' });
}
export function listCities() {
  return request<string[]>('/cities', undefined, { method: 'GET' });
}
```

- [ ] **Step 3: Write the failing tests**

Create `src/artist/__tests__/format.test.ts`:

```ts
import { formatDuration, formatPrice } from '../format';

it('formats paise as whole rupees with Indian grouping', () => {
  expect(formatPrice(450000)).toBe('₹4,500');
  expect(formatPrice(12500000)).toBe('₹1,25,000');
});

it('formats durations in minutes and hours', () => {
  expect(formatDuration(45)).toBe('45 min');
  expect(formatDuration(180)).toBe('3 hr');
  expect(formatDuration(90)).toBe('1 hr 30 min');
});
```

Create `src/artist/__tests__/upload.test.ts`:

```ts
import { transport } from '../../api/client';
import { MockTransport } from '../../api/mock/transport';
import { postToStorage, uploadImage } from '../upload';

const resize = jest.fn();
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg' },
  ImageManipulator: {
    // 4096×3072 source; resize() scales it the way the native module would.
    manipulate: (uri: string) => {
      let size = { width: 4096, height: 3072 };
      const ctx = {
        resize: (s: { width?: number; height?: number }) => {
          resize(s);
          size = s.width ? { width: s.width, height: (3072 / 4096) * s.width } : { width: (4096 / 3072) * s.height!, height: s.height! };
          return ctx;
        },
        renderAsync: async () => ({ saveAsync: async () => ({ uri: `${uri}#small`, ...size }) }),
      };
      return ctx;
    },
  },
}));

beforeEach(() => resize.mockReset());

it('shrinks the longest side to 2048, gets a ticket, and registers the file with the mock', async () => {
  const spy = jest.spyOn(transport, 'request').mockResolvedValue({ status: 200, json: { upload_url: 'mock://upload', fields: {}, key: 'artists/u1/portfolio/7' } });
  const out = await uploadImage({ uri: 'file:///big.jpg', width: 4096, height: 3072 }, 'portfolio');
  expect(resize).toHaveBeenCalledWith({ width: 2048 });
  expect(spy).toHaveBeenCalledWith(expect.objectContaining({ method: 'POST', path: '/uploads/signature', body: { purpose: 'portfolio' } }));
  expect(out).toEqual({ key: 'artists/u1/portfolio/7', width: 2048, height: 1536 });
  expect((transport as MockTransport).files.get('artists/u1/portfolio/7')).toBe('file:///big.jpg#small');
  spy.mockRestore();
});

it('leaves images within 2048 px at their size', async () => {
  const spy = jest.spyOn(transport, 'request').mockResolvedValue({ status: 200, json: { upload_url: 'mock://upload', fields: {}, key: 'k' } });
  await uploadImage({ uri: 'file:///small.jpg', width: 1200, height: 900 }, 'portfolio');
  expect(resize).not.toHaveBeenCalled();
  spy.mockRestore();
});

it('postToStorage posts the signed fields and the file, and maps failures to ApiError', async () => {
  const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200 });
  global.fetch = fetchMock as unknown as typeof fetch;
  await postToStorage({ upload_url: 'https://api.cloudinary.com/v1_1/demo/image/upload', fields: { public_id: 'k', signature: 's' }, key: 'k' }, 'file:///a.jpg');
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe('https://api.cloudinary.com/v1_1/demo/image/upload');
  expect(init.method).toBe('POST');
  expect(init.body).toBeInstanceOf(FormData);

  fetchMock.mockResolvedValue({ ok: false, status: 400 });
  await expect(postToStorage({ upload_url: 'https://x', fields: {}, key: 'k' }, 'file:///a.jpg')).rejects.toMatchObject({ code: 'upload_failed' });
  fetchMock.mockRejectedValue(new TypeError('offline'));
  await expect(postToStorage({ upload_url: 'https://x', fields: {}, key: 'k' }, 'file:///a.jpg')).rejects.toMatchObject({ code: 'network_error' });
});
```

- [ ] **Step 4: Run them to confirm they fail**

Run: `npx jest src/artist/__tests__`
Expected: FAIL with "Cannot find module '../format'" and "Cannot find module '../upload'".

- [ ] **Step 5: Implement the formatters and the upload pipeline**

Create `src/artist/format.ts`:

```ts
/** ₹ with Indian digit grouping; services are priced in whole rupees, stored as paise. */
export function formatPrice(paise: number): string {
  return `₹${Math.round(paise / 100).toLocaleString('en-IN')}`;
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} min`;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}
```

Create `src/artist/upload.ts`:

```ts
import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { transport } from '../api/client';
import { MockTransport } from '../api/mock/transport';
import { ApiError } from '../api/types';
import type { PhotoInput, UploadPurpose, UploadTicket } from '../api/types';
import * as artistApi from '../api/endpoints/artist';

const MAX_EDGE = 2048; // spec §2: longest side
const QUALITY = 0.8;   // spec §2: JPEG quality
// Backend STORAGE_PROVIDER=fake hands out this URL; there is nothing to post to, so dev skips the upload.
const FAKE_STORAGE = 'https://fake.storage/';

export interface PickedImage { uri: string; width: number; height: number }

/** Opens the photo library; [] when the user cancels. */
export async function pickImages(limit: number): Promise<PickedImage[]> {
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: limit > 1, selectionLimit: limit, quality: 1 });
  if (res.canceled) return [];
  return res.assets.map((a) => ({ uri: a.uri, width: a.width, height: a.height }));
}

/** Spec §2: shrink on the device, get a signed form, post straight to storage, and return what our API needs. */
export async function uploadImage(image: PickedImage, purpose: UploadPurpose): Promise<PhotoInput> {
  const small = await shrink(image);
  const ticket = await artistApi.uploadTicket(purpose);
  if (transport instanceof MockTransport) transport.files.set(ticket.key, small.uri);
  else if (!ticket.upload_url.startsWith(FAKE_STORAGE)) await postToStorage(ticket, small.uri);
  return { key: ticket.key, width: Math.round(small.width), height: Math.round(small.height) };
}

async function shrink({ uri, width, height }: PickedImage): Promise<PickedImage> {
  const ctx = ImageManipulator.manipulate(uri);
  if (Math.max(width, height) > MAX_EDGE) ctx.resize(width >= height ? { width: MAX_EDGE } : { height: MAX_EDGE });
  const saved = await (await ctx.renderAsync()).saveAsync({ compress: QUALITY, format: SaveFormat.JPEG });
  return { uri: saved.uri, width: saved.width, height: saved.height };
}

/** Multipart POST of the signed fields plus the file. Failures become ApiErrors so screens can show them. */
export async function postToStorage(ticket: UploadTicket, uri: string): Promise<void> {
  const form = new FormData();
  for (const [k, v] of Object.entries(ticket.fields)) form.append(k, v);
  if (Platform.OS === 'web') form.append('file', await (await fetch(uri)).blob(), 'photo.jpg');
  else form.append('file', { uri, name: 'photo.jpg', type: 'image/jpeg' } as unknown as Blob); // React Native's file part
  let res: Response;
  try {
    res = await fetch(ticket.upload_url, { method: 'POST', body: form });
  } catch {
    throw new ApiError('network_error', 'Network unreachable. Check your connection.', 0);
  }
  if (!res.ok) throw new ApiError('upload_failed', 'Couldn’t upload that photo. Please try again.', res.status);
}
```

- [ ] **Step 6: Run the tests to confirm they pass**

Run: `npx jest src/artist/__tests__`
Expected: PASS.

- [ ] **Step 7: Typecheck and commit**

Run: `npx tsc --noEmit`
Expected: no errors.

```bash
git add package.json package-lock.json src/api/endpoints/artist.ts src/api/endpoints/catalog.ts src/artist/upload.ts src/artist/format.ts src/artist/__tests__/upload.test.ts src/artist/__tests__/format.test.ts
git commit -m "feat(mobile): artist and catalog endpoints, on-device shrink and signed upload"
```

---

### Task 3: Query cache, artist routing and the In review screen

**Files:**
- Create: `src/api/query-client.ts`
- Create: `src/artist/routing.ts`
- Create: `src/artist/flow-context.tsx`
- Create: `src/artist/queries.ts`
- Modify: `app/_layout.tsx`
- Modify: `src/auth/auth-provider.tsx`
- Move: `app/artist/index.tsx` → `app/artist/home.tsx`
- Rewrite: `app/artist/_layout.tsx`; create a new `app/artist/index.tsx`
- Create: `app/artist/in-review.tsx`
- Create: `app/artist/onboarding/_layout.tsx`, `app/artist/onboarding/intro.tsx` (a stub here; Task 4 builds the full screen)
- Test: `src/artist/__tests__/routing.test.ts`; modify `src/__tests__/auth-flow.test.tsx`

**Interfaces:**
- Consumes: `src/api/endpoints/artist.ts` and `catalog.ts` (Task 2).
- Produces:
  - `queryClient` from `src/api/query-client.ts`.
  - `artistStage(profile: ArtistProfile | null, editing: boolean): 'onboarding' | 'review' | 'live'`
  - `resumeStep(profile: ArtistProfile | null): 'intro' | 'services' | 'portfolio'`
  - `artistHref(profile, editing): string`
  - `useArtistFlow(): { editing: boolean; startEditing: () => void }`
  - `useArtistProfile()`, a `useQuery` result whose `data` is `ArtistProfile | null`
  - `useArtistWrite(): (write: () => Promise<ArtistProfile>) => Promise<ArtistProfile>`
  - `useCategories()` and `useCities()`
  - Routes `/artist/onboarding/intro`, `/artist/in-review` and `/artist/home`.

- [ ] **Step 1: Write the failing routing tests**

Create `src/artist/__tests__/routing.test.ts`:

```ts
import { artistHref, artistStage, resumeStep } from '../routing';
import type { ArtistProfile } from '../../api/types';

const profile = (over: Partial<ArtistProfile> = {}): ArtistProfile => ({
  id: 'a', status: 'draft', business_name: 'B', city: 'Pune', bio: null, photo_key: 'k', photo_url: 'u',
  categories: [{ id: 1, slug: 'mehendi', name: 'Mehendi' }], services: [], photos: [],
  rejection_reason: null, submitted_at: null, reviewed_at: null, ...over,
});
const service = { id: 's', category_id: 1, name: 'S', price_paise: 100, duration_minutes: 60, description: null };

it('stage follows the review status; a rejection waits on In review until the artist edits', () => {
  expect(artistStage(null, false)).toBe('onboarding');
  expect(artistStage(profile(), false)).toBe('onboarding');
  expect(artistStage(profile({ status: 'pending' }), false)).toBe('review');
  expect(artistStage(profile({ status: 'pending' }), true)).toBe('review');
  expect(artistStage(profile({ status: 'rejected' }), false)).toBe('review');
  expect(artistStage(profile({ status: 'rejected' }), true)).toBe('onboarding');
  expect(artistStage(profile({ status: 'approved' }), false)).toBe('live');
});

it('a draft resumes at the first step the server has no data for', () => {
  expect(resumeStep(null)).toBe('intro');
  expect(resumeStep(profile())).toBe('services');
  expect(resumeStep(profile({ services: [service] }))).toBe('portfolio');
});

it('artistHref maps each stage to its route; editing a rejection starts at Profile', () => {
  expect(artistHref(null, false)).toBe('/artist/onboarding/intro');
  expect(artistHref(profile({ services: [service] }), false)).toBe('/artist/onboarding/portfolio');
  expect(artistHref(profile({ status: 'pending' }), false)).toBe('/artist/in-review');
  expect(artistHref(profile({ status: 'rejected' }), true)).toBe('/artist/onboarding/profile');
  expect(artistHref(profile({ status: 'approved' }), false)).toBe('/artist/home');
});
```

- [ ] **Step 2: Run them to confirm they fail**

Run: `npx jest src/artist/__tests__/routing.test.ts`
Expected: FAIL with "Cannot find module '../routing'".

- [ ] **Step 3: Implement routing, the query client, the flow context and the queries**

Create `src/artist/routing.ts`:

```ts
import type { ArtistProfile } from '../api/types';

/** Which artist area to show. Drives both the artist layout guards and the `/artist` hub. */
export type ArtistStage = 'onboarding' | 'review' | 'live';
export type ResumeStep = 'intro' | 'services' | 'portfolio';

export function artistStage(profile: ArtistProfile | null, editing: boolean): ArtistStage {
  if (!profile || profile.status === 'draft') return 'onboarding';
  if (profile.status === 'approved') return 'live';
  if (profile.status === 'rejected' && editing) return 'onboarding';
  return 'review'; // pending, or rejected until they press "Edit and resubmit"
}

/** Spec §4: each Continue saves, so a returning artist resumes at the first step the server has no data for. */
export function resumeStep(profile: ArtistProfile | null): ResumeStep {
  if (!profile) return 'intro'; // the Profile step creates the row, so a saved row always has profile details
  if (!profile.services.length) return 'services';
  return 'portfolio';
}

export function artistHref(profile: ArtistProfile | null, editing: boolean): string {
  switch (artistStage(profile, editing)) {
    case 'live':
      return '/artist/home';
    case 'review':
      return '/artist/in-review';
    case 'onboarding':
      return `/artist/onboarding/${editing ? 'profile' : resumeStep(profile)}`;
  }
}
```

Create `src/api/query-client.ts`:

```ts
import { AppState, Platform } from 'react-native';
import { QueryClient, focusManager } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

// React Native has no window focus: coming back to the app counts as focus, so In review picks up a decision.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => focusManager.setFocused(state === 'active'));
}
```

Create `src/artist/flow-context.tsx`:

```tsx
import { createContext, useContext } from 'react';

/** "Edit and resubmit" flips `editing`, which moves a rejected artist from In review back into onboarding. */
export interface ArtistFlow { editing: boolean; startEditing: () => void }

export const ArtistFlowContext = createContext<ArtistFlow>({ editing: false, startEditing: () => {} });

export function useArtistFlow(): ArtistFlow {
  return useContext(ArtistFlowContext);
}
```

Create `src/artist/queries.ts`:

```ts
import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as artistApi from '../api/endpoints/artist';
import * as catalogApi from '../api/endpoints/catalog';
import type { ArtistProfile } from '../api/types';
import { useAuth } from '../auth/auth-provider';

// Keyed by user id, so a different account never sees a cached profile.
const artistKey = (userId: string | undefined) => ['artist', 'me', userId] as const;

export function useArtistProfile() {
  const { user } = useAuth();
  return useQuery({ queryKey: artistKey(user?.id), queryFn: artistApi.getMyProfile, enabled: !!user });
}

/** Every artist write returns the whole profile; caching it re-renders the screens and re-runs the guards at once. */
export function useArtistWrite() {
  const { user } = useAuth();
  const client = useQueryClient();
  return useCallback(async (write: () => Promise<ArtistProfile>) => {
    const profile = await write();
    client.setQueryData(artistKey(user?.id), profile);
    return profile;
  }, [client, user?.id]);
}

export function useCategories() {
  return useQuery({ queryKey: ['catalog', 'categories'], queryFn: catalogApi.listCategories, staleTime: 5 * 60_000 });
}

export function useCities() {
  return useQuery({ queryKey: ['catalog', 'cities'], queryFn: catalogApi.listCities, staleTime: Infinity });
}
```

- [ ] **Step 4: Run the routing tests**

Run: `npx jest src/artist/__tests__/routing.test.ts`
Expected: PASS.

- [ ] **Step 5: Provide the query client and clear it on sign-out**

`app/_layout.tsx`: add the imports and wrap `AuthProvider`. The root guards are unchanged.

```tsx
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../src/api/query-client';
```

```tsx
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Gate />
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
```

`src/auth/auth-provider.tsx`: add the import and clear the cache inside `signOut`:

```ts
import { queryClient } from '../api/query-client';
```

```ts
    signOut: async () => {
      accessTokenRef.current = null;
      setUser(null);
      setStatus('unauthenticated');
      queryClient.clear(); // no cached profile survives into the next account
      await sessionStore.clear();
    },
```

- [ ] **Step 6: Build the artist area routes**

Move the home: `git mv app/artist/index.tsx app/artist/home.tsx`, then replace its two comment lines with:

```tsx
// Artist home: shown once the profile is approved (the artist layout guards it). Grows into the dashboard later.
```

Rewrite `app/artist/_layout.tsx`:

```tsx
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { useTheme } from '../../src/theme/theme-provider';
import { AppText } from '../../src/components/AppText';
import { AppButton } from '../../src/components/AppButton';
import { useArtistProfile } from '../../src/artist/queries';
import { artistStage } from '../../src/artist/routing';
import { ArtistFlowContext } from '../../src/artist/flow-context';
import { errorMessage } from '../../src/api/error-message';

// Artist area. The root guards the folder (role === 'artist'); inside it, the cached
// GET /artists/me picks exactly one area, like the root gate. `index` is the always-mounted
// hub: when a guard flips (submit, Edit and resubmit, approval), the router falls back to it
// and it redirects to the new area.
export default function ArtistLayout() {
  const theme = useTheme();
  const profile = useArtistProfile();
  const [editing, setEditing] = useState(false);
  const status = profile.data?.status;
  useEffect(() => { if (status !== 'rejected') setEditing(false); }, [status]);
  const flow = useMemo(() => ({ editing, startEditing: () => setEditing(true) }), [editing]);

  if (profile.isPending) return <View style={{ flex: 1, backgroundColor: theme.colors.canvas }} />;
  if (profile.isError) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', gap: theme.spacing.lg, padding: theme.spacing.lg, backgroundColor: theme.colors.canvas }}>
        <AppText variant="body" style={{ color: theme.colors.textPrimary, textAlign: 'center' }}>{errorMessage(profile.error)}</AppText>
        <AppButton label="Try again" onPress={() => { void profile.refetch(); }} />
      </View>
    );
  }
  const stage = artistStage(profile.data ?? null, editing);
  return (
    <ArtistFlowContext.Provider value={flow}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.canvas } }}>
        <Stack.Screen name="index" />
        <Stack.Protected guard={stage === 'onboarding'}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>
        <Stack.Protected guard={stage === 'review'}>
          <Stack.Screen name="in-review" />
        </Stack.Protected>
        <Stack.Protected guard={stage === 'live'}>
          <Stack.Screen name="home" />
        </Stack.Protected>
      </Stack>
    </ArtistFlowContext.Provider>
  );
}
```

Create the new `app/artist/index.tsx`:

```tsx
import { Redirect } from 'expo-router';
import { useArtistProfile } from '../../src/artist/queries';
import { useArtistFlow } from '../../src/artist/flow-context';
import { artistHref } from '../../src/artist/routing';

// `/artist` hub: forwards to the one area the artist layout is showing (same rule as its guards).
export default function ArtistIndex() {
  const { data } = useArtistProfile();
  const { editing } = useArtistFlow();
  if (data === undefined) return null; // the layout only mounts the stack once the profile has loaded
  return <Redirect href={artistHref(data, editing)} />;
}
```

Create `app/artist/onboarding/_layout.tsx`:

```tsx
import { Stack } from 'expo-router';
import { useTheme } from '../../../src/theme/theme-provider';

// Intro → Profile → Services → Portfolio. The artist layout guards the whole group; steps
// navigate with push (forward) and dismissTo (back), so a resumed step can still go back.
export default function OnboardingLayout() {
  const theme = useTheme();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.canvas } }} />;
}
```

Create a temporary `app/artist/onboarding/intro.tsx` (Task 4 replaces it):

```tsx
import { FormScreen, FormHeading } from '../../../src/components/FormScreen';

export default function IntroScreen() {
  return (
    <FormScreen>
      <FormHeading eyebrow="BECOME AN ARTIST" title="Turn your craft into" accent="bookings" />
    </FormScreen>
  );
}
```

- [ ] **Step 7: Build the In review screen**

Create `app/artist/in-review.tsx`:

```tsx
import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText, Accent } from '../../src/components/AppText';
import { AppButton } from '../../src/components/AppButton';
import { useTheme } from '../../src/theme/theme-provider';
import { useAuth } from '../../src/auth/auth-provider';
import { useArtistProfile } from '../../src/artist/queries';
import { useArtistFlow } from '../../src/artist/flow-context';

// Atelier hi-fi "onbDone": the review timeline. A rejection shows the admin's reason and "Edit and resubmit" instead.
export default function InReviewScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const { data } = useArtistProfile();
  const { startEditing } = useArtistFlow();
  const rejected = data?.status === 'rejected';
  const submitted = data?.submitted_at
    ? new Date(data.submitted_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
    : '';
  const card = { marginTop: 26, borderRadius: 18, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.separator, padding: 16 } as const;

  return (
    <LinearGradient colors={[theme.colors.washTop, theme.colors.surface]} locations={[0, 0.6]} style={{ flex: 1 }}>
      <View style={{ flex: 1, paddingTop: insets.top + 64, paddingHorizontal: 24, paddingBottom: insets.bottom + 24 }}>
        <Svg width={56} height={36} viewBox="0 0 28 18" fill="none" stroke={theme.colors.accent} strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" style={{ alignSelf: 'center' }}>
          <Path d="M14 9C10 3 3 1 2 5s5 7 12 4zM14 9c4-6 11-8 12-4s-5 7-12 4z" />
          <Path d="M13 10l-3 7M15 10l3 7" />
        </Svg>
        <AppText variant="display" style={{ fontSize: 34, lineHeight: 36, letterSpacing: -0.85, color: theme.colors.heading, textAlign: 'center', marginTop: 18 }}>
          {rejected ? 'Your profile needs ' : 'Your profile is '}<Accent light color={theme.colors.brand}>{rejected ? 'a few changes' : 'in review'}</Accent>
        </AppText>

        {rejected ? (
          <View style={[card, { gap: 6 }]}>
            <AppText variant="label" style={{ color: theme.colors.brand }}>Note from our team</AppText>
            <AppText variant="body" style={{ color: theme.colors.textPrimary }}>{data?.rejection_reason ?? 'Please review your profile and submit again.'}</AppText>
          </View>
        ) : (
          <>
            <AppText variant="body" style={{ fontSize: 14, lineHeight: 21, color: theme.colors.textSecondary, textAlign: 'center', marginTop: 12 }}>
              We check every artist so clients can book with confidence. This usually takes 24–48 hours.
            </AppText>
            <View style={[card, { gap: 16 }]}>
              <Milestone state="done" title="Profile submitted" detail={submitted} />
              <Milestone state="current" title="Portfolio check" detail="In progress · usually 24–48 hrs" />
              <Milestone state="next" title="Go live" detail="Clients can find and book you" />
            </View>
          </>
        )}

        <View style={{ flex: 1 }} />
        <View style={{ gap: 8 }}>
          {rejected ? <AppButton label="Edit and resubmit" onPress={startEditing} /> : null}
          <AppButton label="Sign out" variant="ghost" onPress={() => { void signOut(); }} />
        </View>
      </View>
    </LinearGradient>
  );
}

function Milestone({ state, title, detail }: { state: 'done' | 'current' | 'next'; title: string; detail: string }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 12, opacity: state === 'next' ? 0.55 : 1 }}>
      <View
        style={{
          width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center',
          backgroundColor: state === 'done' ? theme.colors.brand : 'transparent',
          borderWidth: state === 'done' ? 0 : state === 'current' ? 2 : 1.5,
          borderColor: state === 'current' ? theme.colors.accent : theme.colors.border,
        }}
      >
        {state === 'done' ? <AppText style={{ fontSize: 13, color: theme.colors.textOnBrand }}>✓</AppText> : null}
        {state === 'current' ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.accent }} /> : null}
      </View>
      <View>
        <AppText variant="label" style={{ fontSize: 14, color: theme.colors.textPrimary }}>{title}</AppText>
        {detail ? <AppText variant="caption" style={{ color: theme.colors.textMuted }}>{detail}</AppText> : null}
      </View>
    </View>
  );
}
```

- [ ] **Step 8: Update the auth-flow test that now lands on the Intro**

In `src/__tests__/auth-flow.test.tsx`, test `'"Create your profile" on the artist card onboards them as an artist'`, replace its last two lines:

```ts
  expect(await screen.findByText('Welcome, Riya')).toBeTruthy();
  expect(screen.getByText('Artist')).toBeTruthy();
```

with:

```ts
  expect(await screen.findByText('Turn your craft into bookings')).toBeTruthy();
```

The `'a returning artist skips sign-up and role and lands on the artist home'` test stays unchanged: the seeded artist is now approved, so it still shows "Welcome, Priya".

- [ ] **Step 9: Run the full suite**

Run: `npx jest`
Expected: PASS. If an artist test stalls on a blank screen, Expo Router didn't fall back to the hub. Check that `index` is the first, unguarded `Stack.Screen` in `app/artist/_layout.tsx`.

- [ ] **Step 10: Typecheck, lint and commit**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

```bash
git add src/api/query-client.ts src/artist/routing.ts src/artist/flow-context.tsx src/artist/queries.ts src/artist/__tests__/routing.test.ts app/_layout.tsx src/auth/auth-provider.tsx app/artist src/__tests__/auth-flow.test.tsx
git commit -m "feat(mobile): artist area routing on GET /artists/me, In review screen"
```

---

### Task 4: Intro and Profile steps

**Files:**
- Modify: `src/components/FormScreen.tsx`
- Create: `src/components/Chip.tsx`
- Create: `src/artist/CityField.tsx`
- Rewrite: `app/artist/onboarding/intro.tsx`
- Create: `app/artist/onboarding/profile.tsx`
- Create: `app/artist/onboarding/services.tsx` (a stub; Task 5 builds it)
- Test: create `src/__tests__/artist-onboarding.test.tsx` (Tasks 5–7 extend it)

**Interfaces:**
- Consumes: `useArtistProfile`, `useArtistWrite`, `useCategories`, `useCities`, `useArtistFlow` (Task 3); `pickImages` and `uploadImage` (Task 2); `saveProfile` from `src/api/endpoints/artist.ts`.
- Produces:
  - `FormScreen` gains a `steps?: number` prop (default 3).
  - `Chip({ label, selected, onPress })` and `CityField({ value, cities, onChange })`.
  - Test helpers `mockPicks(n)`, `startArtist(national)` and `fillProfile()`.

- [ ] **Step 1: Write the failing flow test (Intro → Profile)**

Create `src/__tests__/artist-onboarding.test.tsx`:

```tsx
import { act } from '@testing-library/react-native';
import { renderRouter, screen, waitFor, fireEvent } from 'expo-router/testing-library';
import * as SecureStore from 'expo-secure-store';
import * as ImagePicker from 'expo-image-picker';

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    setItemAsync: (k: string, v: string) => Promise.resolve(store.set(k, v)),
    getItemAsync: (k: string) => Promise.resolve(store.get(k) ?? null),
    deleteItemAsync: (k: string) => Promise.resolve(store.delete(k)),
    __store: store,
  };
});
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg' },
  ImageManipulator: {
    manipulate: (uri: string) => {
      const ctx = { resize: () => ctx, renderAsync: async () => ({ saveAsync: async () => ({ uri, width: 1200, height: 900 }) }) };
      return ctx;
    },
  },
}));

const store = (SecureStore as unknown as { __store: Map<string, string> }).__store;
const launch = ImagePicker.launchImageLibraryAsync as jest.Mock;
let pickSeq = 0;

/** The next library pick returns `n` photos. */
function mockPicks(n: number) {
  launch.mockResolvedValueOnce({ canceled: false, assets: Array.from({ length: n }, () => ({ uri: `file:///pick-${++pickSeq}.jpg`, width: 3000, height: 2000 })) });
}

let logSpy: jest.SpyInstance;
beforeEach(() => {
  store.clear();
  launch.mockReset();
  logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => { logSpy.mockRestore(); });

/** Fresh number → OTP → name → "Create your profile"; ends on the Intro. */
async function startArtist(national: string, name = 'Ayesha') {
  await renderRouter('./app');
  await fireEvent.press(await screen.findByText('Get started'));
  await fireEvent.changeText(await screen.findByTestId('phone-national'), national);
  await fireEvent.press(screen.getByText('Send code'));
  const banner = await screen.findByText(/^Mock mode: your code is \d{6}$/);
  await fireEvent.changeText(screen.getByTestId('otp-box-0'), String(banner.props.children).match(/\d{6}/)![0]);
  await fireEvent.changeText(await screen.findByLabelText('First name'), name);
  await fireEvent.press(screen.getByText('Continue'));
  await fireEvent.press(await screen.findByText('Create your profile'));
  expect(await screen.findByText('Turn your craft into bookings')).toBeTruthy();
}

/** Intro → Profile, filled in and saved; ends on Services. */
async function fillProfile() {
  await fireEvent.press(screen.getByText('Let’s get started'));
  expect(await screen.findByText('Tell clients who you are')).toBeTruthy();
  expect(screen.getByLabelText('Step 1 of 3')).toBeTruthy();
  mockPicks(1);
  await fireEvent.press(screen.getByLabelText('Add profile photo'));
  expect(await screen.findByLabelText('Change profile photo')).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('Business name'), 'Ayesha Mehendi Art');
  await fireEvent.press(await screen.findByText('Mehendi'));
  await fireEvent.press(screen.getByLabelText('City'));
  await fireEvent.press(await screen.findByText('Bangalore'));
  await fireEvent.press(screen.getByText('Continue'));
  expect(await screen.findByLabelText('Step 2 of 3')).toBeTruthy();
}

it('Intro → Profile saves a draft and moves on to Services', async () => {
  await startArtist('9845044441');
  expect(screen.getByText('3 short steps')).toBeTruthy();
  expect(screen.queryByText(/every Monday/)).toBeNull();
  await fillProfile();
});

it('Profile Continue stays disabled until photo, name, a category and a city are set', async () => {
  await startArtist('9845044442');
  await fireEvent.press(screen.getByText('Let’s get started'));
  await fireEvent.changeText(await screen.findByLabelText('Business name'), 'Studio');
  await fireEvent.press(await screen.findByText('Makeup'));
  await fireEvent.press(screen.getByText('Continue'));
  expect(screen.queryByLabelText('Step 2 of 3')).toBeNull(); // no photo or city yet
});
```

(`act` is imported now for the Task 7 tests, so all imports stay at the top. If lint flags it as unused before Task 7, add it in Task 7 instead.)

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx jest src/__tests__/artist-onboarding.test.tsx`
Expected: FAIL. The stub Intro has no "3 short steps" text or "Let’s get started" button.

- [ ] **Step 3: Give `FormScreen` a step count**

In `src/components/FormScreen.tsx`, replace the constant:

```tsx
const AUTH_STEPS = 3; // Log in → Verify → Your details (artist onboarding passes its own count)
```

Change the signature:

```tsx
export function FormScreen({ onBack, step, steps = AUTH_STEPS, footer, children }: { onBack?: () => void; step?: number; steps?: number; footer?: ReactNode; children: ReactNode }) {
```

Then replace both uses of `STEPS` in the body (`accessibilityLabel` and `Array.from`) with `steps`.

- [ ] **Step 4: Create `Chip` and `CityField`**

Create `src/components/Chip.tsx`:

```tsx
import { Pressable } from 'react-native';
import { AppText } from './AppText';
import { useTheme } from '../theme/theme-provider';

/** Atelier selectable pill (Profile "What do you offer?"): filled rose with a tick when selected. */
export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={{
        height: 36, paddingHorizontal: 14, borderRadius: theme.radii.pill, justifyContent: 'center',
        backgroundColor: selected ? theme.colors.brand : theme.colors.surface,
        borderWidth: selected ? 0 : 1, borderColor: theme.colors.border,
      }}
    >
      <AppText variant="label" style={{ fontSize: 13, color: selected ? theme.colors.textOnBrand : theme.colors.textPrimary }}>
        {selected ? `✓ ${label}` : label}
      </AppText>
    </Pressable>
  );
}
```

Create `src/artist/CityField.tsx`:

```tsx
import { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../components/AppText';
import { fieldBorder } from '../components/FieldHalo';
import { useTheme } from '../theme/theme-provider';

/** Field-styled button that opens a bottom-sheet list of the supported cities. */
export function CityField({ value, cities, onChange }: { value: string | null; cities: string[]; onChange: (city: string) => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="City"
        onPress={() => setOpen(true)}
        style={{
          height: 50, borderRadius: theme.radii.md, ...fieldBorder(theme.colors, false, false), backgroundColor: theme.colors.inputBackground,
          paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        }}
      >
        <AppText variant="subtitle" style={{ color: value ? theme.colors.textPrimary : theme.colors.textMuted }}>{value ?? 'Choose your city'}</AppText>
        <AppText style={{ color: theme.colors.brand }}>▾</AppText>
      </Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable accessibilityLabel="Close" style={{ flex: 1, backgroundColor: theme.colors.overlay }} onPress={() => setOpen(false)} />
        <View style={{ backgroundColor: theme.colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12, paddingBottom: insets.bottom + 12 }}>
          {cities.map((city) => (
            <Pressable
              key={city}
              accessibilityRole="button"
              onPress={() => { onChange(city); setOpen(false); }}
              style={{ paddingVertical: 14, paddingHorizontal: 24, flexDirection: 'row', justifyContent: 'space-between' }}
            >
              <AppText variant="subtitle" style={{ color: theme.colors.textPrimary }}>{city}</AppText>
              {city === value ? <AppText style={{ color: theme.colors.brand }}>✓</AppText> : null}
            </Pressable>
          ))}
        </View>
      </Modal>
    </>
  );
}
```

- [ ] **Step 5: Build the Intro**

Replace `app/artist/onboarding/intro.tsx`:

```tsx
import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText, Accent } from '../../../src/components/AppText';
import { AppButton } from '../../../src/components/AppButton';
import { useTheme } from '../../../src/theme/theme-provider';
import { useAuth } from '../../../src/auth/auth-provider';

const ARTIST_PHOTO = require('../../../assets/hero/role-artist.webp');
const WELCOME_PHOTO = require('../../../assets/hero/welcome.webp');
const CLIENT_PHOTO = require('../../../assets/hero/role-customer.webp');
const BENEFITS = ['Show your work to clients near you', 'Set your own services and prices']; // payouts line dropped until payouts exist

// Atelier hi-fi "onbIntro": photo collage, headline, benefits and "3 short steps".
export default function IntroScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const tile = { borderRadius: 22, backgroundColor: theme.colors.imageFallback } as const;
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.washTop, paddingTop: insets.top + 12, paddingHorizontal: 24, paddingBottom: insets.bottom + 16 }}>
      {/* The role is already chosen, so there is nothing to go back to: ✕ signs out, like Back on sign-up. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Sign out"
        onPress={() => { void signOut(); }}
        style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.surface, alignItems: 'center', justifyContent: 'center' }}
      >
        <AppText style={{ fontSize: 16, color: theme.colors.textPrimary }}>✕</AppText>
      </Pressable>
      <View style={{ flexDirection: 'row', gap: 8, height: 308, marginTop: 18 }}>
        <Image source={ARTIST_PHOTO} contentFit="cover" style={[tile, { flex: 1.2 }]} />
        <View style={{ flex: 1, gap: 8 }}>
          <Image source={WELCOME_PHOTO} contentFit="cover" style={[tile, { flex: 1 }]} />
          <Image source={CLIENT_PHOTO} contentFit="cover" style={[tile, { flex: 1 }]} />
        </View>
      </View>
      <AppText variant="display" style={{ fontSize: 36, lineHeight: 38, letterSpacing: -0.9, color: theme.colors.heading, marginTop: 26 }}>
        {'Turn your craft into '}<Accent light color={theme.colors.brand}>bookings</Accent>
      </AppText>
      <View style={{ gap: 10, marginTop: 18 }}>
        {BENEFITS.map((line) => (
          <View key={line} style={{ flexDirection: 'row', gap: 10 }}>
            <AppText style={{ color: theme.colors.brand }}>✦</AppText>
            <AppText variant="body" style={{ fontSize: 14, color: theme.colors.textSecondary }}>{line}</AppText>
          </View>
        ))}
      </View>
      <View style={{ flex: 1 }} />
      <AppText variant="caption" style={{ textAlign: 'center', color: theme.colors.textSecondary, marginBottom: 10 }}>3 short steps</AppText>
      <AppButton label="Let’s get started" onPress={() => router.push('/artist/onboarding/profile')} />
    </View>
  );
}
```

- [ ] **Step 6: Build the Profile step**

Create `app/artist/onboarding/profile.tsx`:

```tsx
import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { FormScreen, FormHeading } from '../../../src/components/FormScreen';
import { AppText } from '../../../src/components/AppText';
import { AppButton } from '../../../src/components/AppButton';
import { AppTextField } from '../../../src/components/AppTextField';
import { Chip } from '../../../src/components/Chip';
import { CityField } from '../../../src/artist/CityField';
import { useTheme } from '../../../src/theme/theme-provider';
import { useArtistProfile, useArtistWrite, useCategories, useCities } from '../../../src/artist/queries';
import { useArtistFlow } from '../../../src/artist/flow-context';
import { pickImages, uploadImage } from '../../../src/artist/upload';
import * as artistApi from '../../../src/api/endpoints/artist';
import { errorMessage } from '../../../src/api/error-message';

const MAX_CATEGORIES = 6; // backend ProfileIn.category_ids max_length

// Atelier hi-fi "onbProfile" (step 1 of 3): photo, business name, categories and city. Continue saves the draft.
export default function ProfileStep() {
  const theme = useTheme();
  const router = useRouter();
  const { data: saved } = useArtistProfile();
  const { editing } = useArtistFlow();
  const write = useArtistWrite();
  const categories = useCategories();
  const cities = useCities();

  const [photoKey, setPhotoKey] = useState(saved?.photo_key ?? null);
  const [photoUri, setPhotoUri] = useState(saved?.photo_url ?? null);
  const [name, setName] = useState(saved?.business_name ?? '');
  const [picked, setPicked] = useState<number[]>(saved?.categories.map((c) => c.id) ?? []);
  const [city, setCity] = useState(saved?.city ?? null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const choosePhoto = async () => {
    setError(null);
    try {
      const [image] = await pickImages(1);
      if (!image) return;
      setUploading(true);
      setPhotoUri(image.uri);
      setPhotoKey((await uploadImage(image, 'artist_photo')).key);
    } catch (e) {
      setPhotoUri(saved?.photo_url ?? null);
      setError(errorMessage(e));
    } finally {
      setUploading(false);
    }
  };

  const toggle = (id: number) =>
    setPicked((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : ids.length < MAX_CATEGORIES ? [...ids, id] : ids));

  const ready = !!photoKey && !!name.trim() && picked.length > 0 && !!city && !uploading;
  const save = async () => {
    if (!ready || !city) return;
    setSaving(true);
    setError(null);
    try {
      await write(() => artistApi.saveProfile({ business_name: name.trim(), city, category_ids: picked, photo_key: photoKey }));
      router.push('/artist/onboarding/services');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormScreen
      // Editing a rejection starts here, so there is no Intro behind it.
      onBack={editing ? undefined : () => router.dismissTo('/artist/onboarding/intro')}
      step={1}
      steps={3}
      footer={<AppButton label="Continue" onPress={() => { void save(); }} loading={saving} disabled={!ready} />}
    >
      <FormHeading eyebrow="STEP 1 · PROFILE" title="Tell clients" accent="who you are" />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={photoKey ? 'Change profile photo' : 'Add profile photo'}
        onPress={() => { void choosePhoto(); }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 20 }}
      >
        <View style={{ width: 84, height: 84, borderRadius: 42, borderWidth: 2, borderStyle: 'dashed', borderColor: theme.colors.border, padding: 3 }}>
          <View style={{ flex: 1, borderRadius: 38, overflow: 'hidden', backgroundColor: theme.colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
            {photoUri ? <Image source={{ uri: photoUri }} contentFit="cover" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} /> : <AppText style={{ fontSize: 22, color: theme.colors.brand }}>+</AppText>}
            {uploading ? <ActivityIndicator color={theme.colors.brand} /> : null}
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <AppText variant="label" style={{ fontSize: 14, color: theme.colors.textPrimary }}>Profile photo</AppText>
          <AppText variant="caption" style={{ color: theme.colors.textMuted, marginTop: 2 }}>A clear, smiling photo builds trust</AppText>
        </View>
      </Pressable>

      <View style={{ marginTop: 20 }}>
        <AppTextField label="Business name" value={name} onChangeText={setName} maxLength={120} autoCapitalize="words" placeholder="e.g. Ayesha Mehendi Art" />
      </View>

      <AppText variant="label" style={{ color: theme.colors.textSecondary, marginTop: 16 }}>What do you offer?</AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
        {(categories.data ?? []).map((c) => (
          <Chip key={c.id} label={c.name} selected={picked.includes(c.id)} onPress={() => toggle(c.id)} />
        ))}
      </View>

      <AppText variant="label" style={{ color: theme.colors.textSecondary, marginTop: 16, marginBottom: 8 }}>City</AppText>
      <CityField value={city} cities={cities.data ?? []} onChange={setCity} />

      {error ? <AppText variant="caption" style={{ color: theme.colors.error, marginTop: theme.spacing.md }}>{error}</AppText> : null}
    </FormScreen>
  );
}
```

Create a temporary `app/artist/onboarding/services.tsx` (Task 5 replaces it):

```tsx
import { FormScreen, FormHeading } from '../../../src/components/FormScreen';

export default function ServicesStep() {
  return (
    <FormScreen step={2} steps={3}>
      <FormHeading eyebrow="STEP 2 · SERVICES" title="Set your" accent="prices" />
    </FormScreen>
  );
}
```

- [ ] **Step 7: Run the flow tests**

Run: `npx jest src/__tests__/artist-onboarding.test.tsx src/__tests__/auth-flow.test.tsx`
Expected: PASS. If "Let’s get started" isn't found, make sure the test and the button both use the curly apostrophe `’`, as the existing screens do.

- [ ] **Step 8: Typecheck, lint and commit**

Run: `npx tsc --noEmit && npm run lint`

```bash
git add src/components/FormScreen.tsx src/components/Chip.tsx src/artist/CityField.tsx app/artist/onboarding src/__tests__/artist-onboarding.test.tsx
git commit -m "feat(mobile): artist onboarding Intro and Profile steps"
```

---

### Task 5: Services step

**Files:**
- Create: `src/artist/AddServiceSheet.tsx`
- Rewrite: `app/artist/onboarding/services.tsx`
- Create: `app/artist/onboarding/portfolio.tsx` (a stub; Task 6 builds it)
- Test: extend `src/__tests__/artist-onboarding.test.tsx`

**Interfaces:**
- Consumes: `fillProfile()` (Task 4 test helper), `formatPrice` and `formatDuration` (Task 2), and `addService` / `deleteService` from `src/api/endpoints/artist.ts`.
- Produces: `AddServiceSheet({ visible, categories, onClose, onSubmit: (ServiceInput) => Promise<void> })`, and the test helper `addService()`, which ends with "Bridal mehendi" listed.

- [ ] **Step 1: Write the failing tests**

Append to `src/__tests__/artist-onboarding.test.tsx`:

```tsx
/** Services: add "Bridal mehendi" (₹4,500, 180 min) through the sheet. */
async function addService() {
  await fireEvent.press(screen.getByText('+ Add service'));
  await fireEvent.changeText(await screen.findByLabelText('Service name'), 'Bridal mehendi');
  await fireEvent.changeText(screen.getByLabelText('Price (₹)'), '4500');
  await fireEvent.changeText(screen.getByLabelText('Duration (minutes)'), '180');
  await fireEvent.press(screen.getByText('Save service'));
  expect(await screen.findByText('Bridal mehendi')).toBeTruthy();
  expect(screen.getByText('Mehendi · ₹4,500 · 3 hr')).toBeTruthy();
}

it('Services: Continue needs a service; services can be added and removed', async () => {
  await startArtist('9845044443');
  await fillProfile();
  expect(screen.getByText('Set your prices')).toBeTruthy();
  await fireEvent.press(screen.getByText('Continue'));
  expect(screen.queryByLabelText('Step 3 of 3')).toBeNull();

  await addService();
  await fireEvent.press(screen.getByLabelText('Remove Bridal mehendi'));
  await waitFor(() => expect(screen.queryByText('Bridal mehendi')).toBeNull());

  await addService();
  await fireEvent.press(screen.getByText('Continue'));
  expect(await screen.findByLabelText('Step 3 of 3')).toBeTruthy();
});

it('the Add service sheet rejects a zero price before calling the server', async () => {
  await startArtist('9845044444');
  await fillProfile();
  await fireEvent.press(screen.getByText('+ Add service'));
  await fireEvent.changeText(await screen.findByLabelText('Service name'), 'Trial');
  await fireEvent.changeText(screen.getByLabelText('Price (₹)'), '0');
  await fireEvent.changeText(screen.getByLabelText('Duration (minutes)'), '30');
  await fireEvent.press(screen.getByText('Save service'));
  expect(await screen.findByText('Enter a price above ₹0.')).toBeTruthy();
});
```

- [ ] **Step 2: Run them to confirm they fail**

Run: `npx jest src/__tests__/artist-onboarding.test.tsx -t "Services|Add service"`
Expected: FAIL. `'+ Add service'` isn't found.

- [ ] **Step 3: Build the sheet**

Create `src/artist/AddServiceSheet.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../components/AppText';
import { AppButton } from '../components/AppButton';
import { AppTextField } from '../components/AppTextField';
import { Chip } from '../components/Chip';
import { useTheme } from '../theme/theme-provider';
import { errorMessage } from '../api/error-message';
import type { Category, ServiceInput } from '../api/types';

const MAX_RUPEES = 1_000_000; // backend ServiceIn: price_paise ≤ 100 000 000
const MAX_MINUTES = 1440;

/** Bottom sheet for one service: category (from the artist's own), name, price in ₹ and duration in minutes. */
export function AddServiceSheet({ visible, categories, onClose, onSubmit }: {
  visible: boolean;
  categories: Category[];
  onClose: () => void;
  onSubmit: (service: ServiceInput) => Promise<void>;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [minutes, setMinutes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Each opening starts blank; a single category is preselected.
  useEffect(() => {
    if (!visible) return;
    setCategoryId(categories.length === 1 ? categories[0].id : null);
    setName(''); setPrice(''); setMinutes(''); setError(null);
  }, [visible, categories]);

  const save = async () => {
    const rupees = Number(price);
    const mins = Number(minutes);
    if (categoryId === null) { setError('Pick a category.'); return; }
    if (!Number.isInteger(rupees) || rupees <= 0 || rupees > MAX_RUPEES) { setError('Enter a price above ₹0.'); return; }
    if (!Number.isInteger(mins) || mins <= 0 || mins > MAX_MINUTES) { setError('Enter a duration between 1 and 1440 minutes.'); return; }
    setSaving(true);
    setError(null);
    try {
      await onSubmit({ category_id: categoryId, name: name.trim(), price_paise: rupees * 100, duration_minutes: mins });
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable accessibilityLabel="Close" style={{ flex: 1, backgroundColor: theme.colors.overlay }} onPress={onClose} />
        <View style={{ backgroundColor: theme.colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: insets.bottom + 16, gap: 14 }}>
          <AppText variant="title" style={{ color: theme.colors.heading }}>Add a service</AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {categories.map((c) => <Chip key={c.id} label={c.name} selected={categoryId === c.id} onPress={() => setCategoryId(c.id)} />)}
          </View>
          <AppTextField label="Service name" value={name} onChangeText={setName} maxLength={120} placeholder="e.g. Bridal mehendi" />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <AppTextField label="Price (₹)" value={price} onChangeText={setPrice} keyboardType="number-pad" placeholder="4500" />
            </View>
            <View style={{ flex: 1 }}>
              <AppTextField label="Duration (minutes)" value={minutes} onChangeText={setMinutes} keyboardType="number-pad" placeholder="120" />
            </View>
          </View>
          {error ? <AppText variant="caption" style={{ color: theme.colors.error }}>{error}</AppText> : null}
          <AppButton label="Save service" onPress={() => { void save(); }} loading={saving} disabled={!name.trim()} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
```

- [ ] **Step 4: Build the Services step**

Replace `app/artist/onboarding/services.tsx`:

```tsx
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FormScreen, FormHeading } from '../../../src/components/FormScreen';
import { AppText } from '../../../src/components/AppText';
import { AppButton } from '../../../src/components/AppButton';
import { AddServiceSheet } from '../../../src/artist/AddServiceSheet';
import { useTheme } from '../../../src/theme/theme-provider';
import { useArtistProfile, useArtistWrite } from '../../../src/artist/queries';
import { formatDuration, formatPrice } from '../../../src/artist/format';
import * as artistApi from '../../../src/api/endpoints/artist';
import { errorMessage } from '../../../src/api/error-message';

// Step 2 of 3 (not drawn in the design; follows the Profile step): the artist's service menu.
export default function ServicesStep() {
  const theme = useTheme();
  const router = useRouter();
  const { data: profile } = useArtistProfile();
  const write = useArtistWrite();
  const [sheet, setSheet] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const services = profile?.services ?? [];
  const categoryName = (id: number) => profile?.categories.find((c) => c.id === id)?.name ?? '';

  const remove = async (id: string) => {
    setError(null);
    try { await write(() => artistApi.deleteService(id)); } catch (e) { setError(errorMessage(e)); }
  };

  return (
    <FormScreen
      onBack={() => router.dismissTo('/artist/onboarding/profile')}
      step={2}
      steps={3}
      footer={<AppButton label="Continue" onPress={() => router.push('/artist/onboarding/portfolio')} disabled={!services.length} />}
    >
      <FormHeading eyebrow="STEP 2 · SERVICES" title="Set your" accent="prices" subtitle="Add what clients can book. You need at least one service." />
      <View style={{ gap: 10, marginTop: 20 }}>
        {services.map((s) => (
          <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: theme.radii.md, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.separator }}>
            <View style={{ flex: 1 }}>
              <AppText variant="label" style={{ fontSize: 15, color: theme.colors.textPrimary }}>{s.name}</AppText>
              <AppText variant="caption" style={{ color: theme.colors.textMuted, marginTop: 2 }}>
                {`${categoryName(s.category_id)} · ${formatPrice(s.price_paise)} · ${formatDuration(s.duration_minutes)}`}
              </AppText>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${s.name}`} onPress={() => { void remove(s.id); }} hitSlop={8}>
              <AppText style={{ fontSize: 18, color: theme.colors.textMuted }}>✕</AppText>
            </Pressable>
          </View>
        ))}
        <Pressable
          accessibilityRole="button"
          onPress={() => setSheet(true)}
          style={{ height: 52, borderRadius: theme.radii.md, borderWidth: 1.5, borderStyle: 'dashed', borderColor: theme.colors.border, backgroundColor: theme.colors.washTop, alignItems: 'center', justifyContent: 'center' }}
        >
          <AppText variant="label" style={{ color: theme.colors.brand }}>+ Add service</AppText>
        </Pressable>
      </View>
      {error ? <AppText variant="caption" style={{ color: theme.colors.error, marginTop: theme.spacing.md }}>{error}</AppText> : null}
      <AddServiceSheet
        visible={sheet}
        categories={profile?.categories ?? []}
        onClose={() => setSheet(false)}
        onSubmit={async (service) => { await write(() => artistApi.addService(service)); }}
      />
    </FormScreen>
  );
}
```

Create a temporary `app/artist/onboarding/portfolio.tsx` (Task 6 replaces it):

```tsx
import { FormScreen, FormHeading } from '../../../src/components/FormScreen';

export default function PortfolioStep() {
  return (
    <FormScreen step={3} steps={3}>
      <FormHeading eyebrow="STEP 3 · PORTFOLIO" title="Show your" accent="best work" />
    </FormScreen>
  );
}
```

- [ ] **Step 5: Run the tests**

Run: `npx jest src/__tests__/artist-onboarding.test.tsx`
Expected: PASS.

- [ ] **Step 6: Typecheck, lint and commit**

Run: `npx tsc --noEmit && npm run lint`

```bash
git add src/artist/AddServiceSheet.tsx app/artist/onboarding/services.tsx app/artist/onboarding/portfolio.tsx src/__tests__/artist-onboarding.test.tsx
git commit -m "feat(mobile): artist onboarding Services step with Add service sheet"
```

---

### Task 6: Portfolio step and submit

**Files:**
- Rewrite: `app/artist/onboarding/portfolio.tsx`
- Test: extend `src/__tests__/artist-onboarding.test.tsx`

**Interfaces:**
- Consumes: `pickImages` and `uploadImage` (Task 2); `addPhoto`, `deletePhoto`, `reorderPhotos` and `submitProfile` from `src/api/endpoints/artist.ts`; and the test helpers `startArtist`, `fillProfile`, `addService` and `mockPicks`.
- Produces: the test helper `addPhotos(n, total)`. Submitting flips the artist stage to `review`.

- [ ] **Step 1: Write the failing test**

Append to `src/__tests__/artist-onboarding.test.tsx`:

```tsx
/** Portfolio: pick and upload `n` photos in one go; waits until `total` tiles are on screen. */
async function addPhotos(n: number, total = n) {
  mockPicks(n);
  await fireEvent.press(screen.getByLabelText('Add photos'));
  await waitFor(() => expect(screen.queryAllByLabelText(/^Portfolio photo \d+$/)).toHaveLength(total), { timeout: 5000 });
}

it('Portfolio: counts toward six, marks the cover, Make cover and Remove work, then submit lands on In review', async () => {
  await startArtist('9845044445');
  await fillProfile();
  await addService();
  await fireEvent.press(screen.getByText('Continue'));
  expect(await screen.findByText('Show your best work')).toBeTruthy();
  expect(screen.getByText('Continue · 0 of 6 photos')).toBeTruthy();

  await addPhotos(5);
  expect(screen.getByText('Continue · 5 of 6 photos')).toBeTruthy();
  expect(screen.getByText('Cover')).toBeTruthy();

  // Long-press selects a tile; Make cover moves it first; Remove drops it.
  await fireEvent(screen.getByLabelText('Portfolio photo 3'), 'longPress');
  await fireEvent.press(await screen.findByText('Make cover'));
  await waitFor(() => expect(screen.queryByText('Make cover')).toBeNull());
  await fireEvent(screen.getByLabelText('Portfolio photo 2'), 'longPress');
  await fireEvent.press(await screen.findByText('Remove'));
  await waitFor(() => expect(screen.queryAllByLabelText(/^Portfolio photo \d+$/)).toHaveLength(4));

  await addPhotos(2, 6);
  await fireEvent.press(await screen.findByText('Submit for review'));
  expect(await screen.findByText('Your profile is in review')).toBeTruthy();
  expect(screen.getByText('Profile submitted')).toBeTruthy();
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx jest src/__tests__/artist-onboarding.test.tsx -t Portfolio`
Expected: FAIL. `'Continue · 0 of 6 photos'` isn't found.

- [ ] **Step 3: Build the Portfolio step**

Replace `app/artist/onboarding/portfolio.tsx`:

```tsx
import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { FormScreen, FormHeading } from '../../../src/components/FormScreen';
import { AppText } from '../../../src/components/AppText';
import { AppButton } from '../../../src/components/AppButton';
import { useTheme } from '../../../src/theme/theme-provider';
import { useArtistProfile, useArtistWrite } from '../../../src/artist/queries';
import { pickImages, uploadImage } from '../../../src/artist/upload';
import * as artistApi from '../../../src/api/endpoints/artist';
import { errorMessage } from '../../../src/api/error-message';

const MIN_PHOTOS = 6;  // backend artist_service.MIN_PHOTOS
const MAX_PHOTOS = 30; // backend artist_service.MAX_PHOTOS

interface Uploading { localId: string; uri: string }

// Atelier hi-fi "onbPortfolio" (step 3 of 3): the first photo is the cover; long-press a tile for Make cover / Remove.
export default function PortfolioStep() {
  const theme = useTheme();
  const router = useRouter();
  const { data: profile } = useArtistProfile();
  const write = useArtistWrite();
  const [uploading, setUploading] = useState<Uploading[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const photos = profile?.photos ?? [];
  const count = photos.length;

  const add = async () => {
    setError(null);
    try {
      const picked = await pickImages(MAX_PHOTOS - count - uploading.length);
      const queued = picked.map((p, i) => ({ ...p, localId: `${Date.now()}-${i}` }));
      setUploading((u) => [...u, ...queued.map(({ localId, uri }) => ({ localId, uri }))]);
      // One at a time, so the portfolio keeps the order they were picked in.
      for (const image of queued) {
        try {
          const uploaded = await uploadImage(image, 'portfolio');
          await write(() => artistApi.addPhoto(uploaded));
        } catch (e) {
          setError(errorMessage(e));
        } finally {
          setUploading((u) => u.filter((x) => x.localId !== image.localId));
        }
      }
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try { await fn(); setSelected(null); } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };
  const makeCover = (id: string) => run(() => write(() => artistApi.reorderPhotos([id, ...photos.filter((p) => p.id !== id).map((p) => p.id)])));
  const remove = (id: string) => run(() => write(() => artistApi.deletePhoto(id)));
  const submit = () => run(() => write(artistApi.submitProfile)); // status → pending; the artist layout moves to In review

  const tile = { width: '31.5%', aspectRatio: 1, borderRadius: 16, overflow: 'hidden', backgroundColor: theme.colors.imageFallback } as const;
  const enough = count >= MIN_PHOTOS;
  return (
    <FormScreen
      onBack={() => router.dismissTo('/artist/onboarding/services')}
      step={3}
      steps={3}
      footer={(
        <AppButton
          label={enough ? 'Submit for review' : `Continue · ${count} of ${MIN_PHOTOS} photos`}
          onPress={() => { void submit(); }}
          loading={busy && enough}
          disabled={!enough || uploading.length > 0}
        />
      )}
    >
      <FormHeading eyebrow="STEP 3 · PORTFOLIO" title="Show your" accent="best work" subtitle={`Add at least ${MIN_PHOTOS} photos. Your first photo becomes your cover.`} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 18 }}>
        {photos.map((p, i) => (
          <Pressable
            key={p.id}
            accessibilityLabel={`Portfolio photo ${i + 1}`}
            accessibilityState={{ selected: selected === p.id }}
            onLongPress={() => setSelected(p.id)}
            onPress={() => setSelected(null)}
            style={[tile, selected === p.id ? { borderWidth: 3, borderColor: theme.colors.brand } : null]}
          >
            <Image source={{ uri: p.thumb_url }} contentFit="cover" style={{ flex: 1 }} />
            {i === 0 ? (
              <View pointerEvents="none" style={{ position: 'absolute', left: 8, top: 8, paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.radii.pill, backgroundColor: theme.colors.surface }}>
                <AppText variant="eyebrow" style={{ fontSize: 10.5, letterSpacing: 0, color: theme.colors.brand }}>Cover</AppText>
              </View>
            ) : null}
          </Pressable>
        ))}
        {uploading.map((u) => (
          <View key={u.localId} style={tile} accessibilityLabel="Uploading photo">
            <Image source={{ uri: u.uri }} contentFit="cover" style={{ flex: 1, opacity: 0.5 }} />
            <ActivityIndicator color={theme.colors.brand} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }} />
          </View>
        ))}
        {count + uploading.length < MAX_PHOTOS ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add photos"
            onPress={() => { void add(); }}
            style={[tile, { borderWidth: 1.5, borderStyle: 'dashed', borderColor: theme.colors.border, backgroundColor: theme.colors.washTop, alignItems: 'center', justifyContent: 'center', gap: 4 }]}
          >
            <AppText style={{ fontSize: 22, color: theme.colors.brand }}>+</AppText>
            <AppText variant="label" style={{ fontSize: 12, color: theme.colors.brand }}>Add</AppText>
          </Pressable>
        ) : null}
      </View>

      {selected ? (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
          {photos[0]?.id !== selected ? (
            <View style={{ flex: 1 }}><AppButton label="Make cover" variant="secondary" onPress={() => { void makeCover(selected); }} disabled={busy} /></View>
          ) : null}
          <View style={{ flex: 1 }}><AppButton label="Remove" variant="ghost" onPress={() => { void remove(selected); }} disabled={busy} /></View>
        </View>
      ) : (
        <View style={{ marginTop: 16, padding: 14, borderRadius: 14, backgroundColor: theme.colors.washTop }}>
          <AppText variant="caption" style={{ color: theme.colors.textSecondary, lineHeight: 19 }}>
            <AppText variant="caption" style={{ color: theme.colors.brand, fontFamily: theme.typography.label.fontFamily }}>✦ Tip: </AppText>
            Daylight photos of finished work get more bookings than studio shots. Long-press a photo to make it your cover or remove it.
          </AppText>
        </View>
      )}
      {error ? <AppText variant="caption" style={{ color: theme.colors.error, marginTop: theme.spacing.md }}>{error}</AppText> : null}
    </FormScreen>
  );
}
```

- [ ] **Step 4: Run the tests**

Run: `npx jest src/__tests__/artist-onboarding.test.tsx`
Expected: PASS. If `fireEvent(…, 'longPress')` doesn't fire, check that the `accessibilityLabel` on the tile's `Pressable` is exactly `Portfolio photo N`.

- [ ] **Step 5: Typecheck, lint and commit**

Run: `npx tsc --noEmit && npm run lint`

```bash
git add app/artist/onboarding/portfolio.tsx src/__tests__/artist-onboarding.test.tsx
git commit -m "feat(mobile): artist onboarding Portfolio step with cover, remove and submit"
```

---

### Task 7: Rejection, resume and approval flows, plus a check on web

**Files:**
- Test: extend `src/__tests__/artist-onboarding.test.tsx`
- Modify: `README.md` in `mobile/` (a short section on the artist flow in mock mode)

**Interfaces:**
- Consumes: everything above, plus `MockTransport.review` (Task 1) and `queryClient` (Task 3).

- [ ] **Step 1: Write the flow tests**

Add to the imports at the top of `src/__tests__/artist-onboarding.test.tsx`:

```tsx
import { transport } from '../api/client';
import { MockTransport } from '../api/mock/transport';
import { queryClient } from '../api/query-client';
```

Append:

```tsx
const mock = transport as MockTransport;

/** Runs the whole flow to In review for a fresh number. */
async function submitFor(national: string) {
  await startArtist(national);
  await fillProfile();
  await addService();
  await fireEvent.press(screen.getByText('Continue'));
  await addPhotos(6);
  await fireEvent.press(await screen.findByText('Submit for review'));
  expect(await screen.findByText('Your profile is in review')).toBeTruthy();
}

it('a rejected profile shows the reason, and Edit and resubmit goes back through the steps', async () => {
  await submitFor('9845044446');
  mock.review('+919845044446', 'rejected', 'Portfolio photos are blurry');
  await act(() => queryClient.invalidateQueries({ queryKey: ['artist'] }));
  expect(await screen.findByText('Portfolio photos are blurry')).toBeTruthy();
  expect(screen.getByText('Your profile needs a few changes')).toBeTruthy();

  await fireEvent.press(screen.getByText('Edit and resubmit'));
  expect(await screen.findByText('Tell clients who you are')).toBeTruthy();
  expect(screen.getByLabelText('Business name').props.value).toBe('Ayesha Mehendi Art'); // prefilled from the saved profile
  await fireEvent.press(screen.getByText('Continue'));
  expect(await screen.findByText('Bridal mehendi')).toBeTruthy();
  await fireEvent.press(screen.getByText('Continue'));
  await fireEvent.press(await screen.findByText('Submit for review'));
  expect(await screen.findByText('Your profile is in review')).toBeTruthy();
});

it('approval moves the artist to the home', async () => {
  await submitFor('9845044447');
  mock.review('+919845044447', 'approved');
  await act(() => queryClient.invalidateQueries({ queryKey: ['artist'] }));
  expect(await screen.findByText('Welcome, Ayesha')).toBeTruthy();
});

it('quitting mid-way resumes at the first incomplete step', async () => {
  await startArtist('9845044448');
  await fillProfile(); // profile saved, no services yet
  // Cold restart: same stored session, empty cache.
  screen.unmount();
  queryClient.clear();
  await renderRouter('./app');
  expect(await screen.findByText('Set your prices')).toBeTruthy();
});
```

- [ ] **Step 2: Run them**

Run: `npx jest src/__tests__/artist-onboarding.test.tsx`
Expected: PASS.

If the rejection test still shows "in review" after `invalidateQueries`, the In review screen isn't reading the refreshed cache. Confirm it uses `useArtistProfile()`.

If "Edit and resubmit" doesn't reach Profile, confirm `index` is the first, unguarded screen in `app/artist/_layout.tsx`. As a fallback, call `router.replace('/artist')` right after `startEditing()` in `in-review.tsx`.

- [ ] **Step 3: Full suite, types and lint**

Run: `npx jest && npx tsc --noEmit && npm run lint`
Expected: all green.

- [ ] **Step 4: Manual check on web against the mock**

Run: `EXPO_PUBLIC_USE_MOCKS=true npx expo start --web --port 8081`

In a browser at 393×852, go through:

1. Get started, then a new number and the OTP from the banner.
2. Enter a name, then "Create your profile".
3. On Intro, press "Let’s get started".
4. On Profile, pick a photo, enter a name, choose a category and a city, then Continue.
5. On Services, add one service, then Continue.
6. On Portfolio, add six photos, make one the cover, remove one, add one, then Submit.

Expected: In review shows the timeline with today's submit time. Compare each screen with the design file's `onbIntro`, `onbProfile`, `onbPortfolio` and `onbDone`.

Stop the server afterwards.

- [ ] **Step 5: Document and commit**

Add to `mobile/README.md`, next to the existing mock-mode notes:

```markdown
### Artist onboarding in mock mode

Choose role → "Create your profile" runs Intro → Profile → Services → Portfolio → In review entirely
against `MockTransport` (categories are the design's six; picked photos are kept as local URIs).
`+1 555 000 9999` is a seeded, already-approved artist. Tests approve or reject with
`(transport as MockTransport).review(phone, 'approved' | 'rejected', reason)`.
Against a real backend with `STORAGE_PROVIDER=fake`, uploads are skipped and photos show as broken images.
```

```bash
git add src/__tests__/artist-onboarding.test.tsx README.md
git commit -m "test(mobile): artist rejection, approval and resume flows; README"
```

---

## Self-review notes

- **Spec coverage (§4 and §6):**
  - Routing by status: Task 3.
  - Intro with "3 short steps" and no payouts line: Task 4.
  - Profile (photo, name, category chips, city picker): Task 4.
  - Services, with Continue needing at least one: Task 5.
  - Portfolio (Cover marking, multi-pick, a spinner per tile, long-press, `Continue · n of 6 photos`, Make cover): Task 6.
  - In review timeline and Sign out: Task 3.
  - Rejection reason with Edit and resubmit: Tasks 3 and 7.
  - Resume at the first incomplete step: `resumeStep` in Task 3, tested in Task 7.
  - New dependencies: Task 2.
  - Every new endpoint in the mock transport, and a fake upload: Task 1, plus `files` in Task 2.
  - §6 tests (choose artist → submit; rejected resumes; approved lands home): Tasks 4–7.
- **Spec points this plan changes or interprets:** listed under "Decisions this plan makes".
- **Type consistency:** `ArtistProfile`, `ServiceItem`, `PhotoInput` and `UploadTicket` are defined in Task 1 and used unchanged afterwards. `useArtistWrite(write: () => Promise<ArtistProfile>)` is used the same way in Tasks 4–6. `artistHref` and `artistStage` take `(profile, editing)` everywhere. Test helpers are defined before they are used: `mockPicks`, `startArtist` and `fillProfile` in Task 4, `addService` in Task 5, `addPhotos` in Task 6, `submitFor` in Task 7.
