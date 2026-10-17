import { MockTransport } from '../../mocks/transport';
import type { ArtistProfile, CatalogCategory, UploadPurpose, UploadTicket } from '../../core/api/types';

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

async function ticket(t: MockTransport, auth: Record<string, string>, purpose: UploadPurpose) {
  const res = await t.request({ method: 'POST', path: '/uploads/signature', headers: auth, body: { purpose } });
  return res.json as UploadTicket;
}

async function draft(t: MockTransport, auth: Record<string, string>) {
  const photo = await ticket(t, auth, 'artist_photo');
  return t.request({ method: 'PUT', path: '/artists/me/profile', headers: auth, body: { business_name: ' Ayesha Mehendi Art ', city: 'Bangalore', category_ids: [1], photo_key: photo.key } });
}

/** Identity step with a generated (not real) Aadhaar number and two fresh card keys. */
async function kyc(t: MockTransport, auth: Record<string, string>, aadhaar_number = '234123412346') {
  const front = await ticket(t, auth, 'aadhaar');
  const back = await ticket(t, auth, 'aadhaar');
  return t.request({ method: 'PUT', path: '/artists/me/kyc', headers: auth, body: { aadhaar_number, front_key: front.key, back_key: back.key } });
}

/** Service name → template id, from the catalog tree (the mock seeds Mehendi › Bridal › Bridal Classic, …). */
async function templates(t: MockTransport) {
  const tree = (await t.request({ method: 'GET', path: '/categories' })).json as CatalogCategory[];
  return Object.fromEntries(tree.flatMap((c) => c.subcategories.flatMap((s) => s.services.map((sv) => [sv.name, sv.id] as const))));
}

/** Draft + one service + six photos + identity: ready to submit. */
async function complete(t: MockTransport, auth: Record<string, string>) {
  await draft(t, auth);
  await t.request({ method: 'POST', path: '/artists/me/services', headers: auth, body: { template_id: (await templates(t))['Bridal Classic'], price_paise: 100, duration_minutes: 60 } });
  for (let i = 0; i < 6; i++) {
    const tk = await ticket(t, auth, 'portfolio');
    await t.request({ method: 'POST', path: '/artists/me/photos', headers: auth, body: { key: tk.key, width: 10, height: 10 } });
  }
  await kyc(t, auth);
}

it('serves the catalog without auth', async () => {
  const t = new MockTransport();
  const cats = await t.request({ method: 'GET', path: '/categories' });
  const tree = cats.json as CatalogCategory[];
  expect(tree.map((c) => c.name)).toEqual(['Mehendi', 'Makeup', 'Hair', 'Photography', 'Decor', 'Tattoo']);
  expect(tree[1].subcategories.map((s) => s.slug)).toEqual(['makeup-bridal', 'makeup-party']);
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
  expect((await ticket(t, auth, 'aadhaar')).key).toMatch(/^artists\/[^/]+\/aadhaar\/\d+$/);
});

it('PUT /artists/me/profile creates a trimmed draft and validates city, categories and photo key', async () => {
  const t = new MockTransport();
  const auth = await artist(t);
  const res = await draft(t, auth);
  expect(res.status).toBe(200);
  expect(res.json).toMatchObject({ status: 'draft', business_name: 'Ayesha Mehendi Art', city: 'Bangalore', categories: [{ id: 1, name: 'Mehendi' }], services: [], photos: [], kyc: null });
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
  const tpl = await templates(t);
  const added = await t.request({ method: 'POST', path: '/artists/me/services', headers: auth, body: { template_id: tpl['Bridal Classic'], price_paise: 450000, duration_minutes: 180 } });
  expect(added.status).toBe(201);
  const svc = (added.json as ArtistProfile).services[0];
  expect(svc).toMatchObject({
    name: 'Bridal Classic', template_id: tpl['Bridal Classic'], price_paise: 450000, duration_minutes: 180,
    description: null, status: 'approved', rejection_reason: null,
  });
  expect(svc.subcategory_id).toBe(svc.category_id); // stored on the subcategory, like the backend
  expect(await t.request({ method: 'POST', path: '/artists/me/services', headers: auth, body: { template_id: tpl['Bridal Full Arms'], price_paise: 0, duration_minutes: 30 } })).toMatchObject({ status: 422 });
  expect(await t.request({ method: 'POST', path: '/artists/me/services', headers: auth, body: { template_id: tpl['Bridal Full Arms'], price_paise: 100, duration_minutes: 1441 } })).toMatchObject({ status: 422 });
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
  expect(await t.request({ method: 'POST', path: '/artists/me/submit', headers: auth })).toMatchObject({ status: 422, json: { code: 'validation_error', missing: ['services', 'portfolio', 'kyc'], min_photos: 6 } });

  await complete(t, auth);
  const sent = await t.request({ method: 'POST', path: '/artists/me/submit', headers: auth });
  expect(sent).toMatchObject({ status: 200, json: { status: 'pending', rejection_reason: null } });
  expect((sent.json as ArtistProfile).submitted_at).toBeTruthy();
  expect(await t.request({ method: 'POST', path: '/artists/me/services', headers: auth, body: { template_id: (await templates(t))['Bridal Full Arms'], price_paise: 100, duration_minutes: 60 } })).toMatchObject({ status: 409, json: { code: 'conflict' } });
});

it('services come from the admin list: unknown, outside the artist’s categories, or already added are refused', async () => {
  const t = new MockTransport();
  const auth = await artist(t);
  await draft(t, auth); // Mehendi only
  const tpl = await templates(t);
  const add = (template_id: number) => t.request({ method: 'POST', path: '/artists/me/services', headers: auth, body: { template_id, price_paise: 100, duration_minutes: 60 } });
  expect(await add(999999)).toMatchObject({ status: 422, json: { message: 'Unknown service' } });
  expect(await add(tpl['Party Makeup'])).toMatchObject({ status: 422, json: { message: 'Pick that category on your profile first' } });
  expect(await add(tpl['Bridal Classic'])).toMatchObject({ status: 201 });
  expect(await add(tpl['Bridal Classic'])).toMatchObject({ status: 409, json: { code: 'conflict', message: "You've already added this service" } });
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

it('the seeded artist has an approved profile with Aadhaar on file', async () => {
  const t = new MockTransport();
  const auth = await signIn(t, '+15550009999');
  expect(await t.request({ method: 'GET', path: '/artists/me', headers: auth })).toMatchObject({ status: 200, json: { status: 'approved', kyc: { aadhaar_last4: '2346' } } });
});

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
