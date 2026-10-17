import { MockTransport } from '../transport';
import type { ArtistCard, ArtistDashboard, ArtistPublic, Availability, Booking, CatalogCategory, Page, UploadTicket } from '../../types';
import { addDays, istDateKey, istDayStart } from '../../../lib/time';

const HOUR = 3600_000;
const PRIYA = '+15550009999'; // the mock's seeded, approved artist

let logSpy: jest.SpyInstance;
beforeEach(() => { logSpy = jest.spyOn(console, 'log').mockImplementation(() => {}); });
afterEach(() => { logSpy.mockRestore(); });

type Auth = Record<string, string>;

async function signIn(t: MockTransport, phone: string): Promise<Auth> {
  let code = '';
  t.onOtpGenerated = (_p, c) => { code = c; };
  t.advanceTime(61_000); // step past the per-number resend cooldown
  await t.request({ method: 'POST', path: '/auth/otp/request', body: { phone } });
  const res = await t.request({ method: 'POST', path: '/auth/otp/verify', body: { phone, code } });
  return { Authorization: `Bearer ${(res.json as { access_token: string }).access_token}` };
}

async function customer(t: MockTransport, phone = '+919800011111'): Promise<Auth> {
  const auth = await signIn(t, phone);
  await t.request({ method: 'PATCH', path: '/users/me', headers: auth, body: { first_name: 'Ananya', last_name: 'Rao' } });
  await t.request({ method: 'PUT', path: '/users/me/role', headers: auth, body: { role: 'customer' } });
  return auth;
}

const get = async <T>(t: MockTransport, path: string, headers?: Auth) => (await t.request({ method: 'GET', path, headers })).json as T;

async function priya(t: MockTransport) {
  const auth = await signIn(t, PRIYA);
  const me = await get<{ id: string }>(t, '/artists/me', auth);
  const store = await get<ArtistPublic>(t, `/artists/${me.id}`);
  return { auth, id: me.id, store };
}

/** 11:00 IST, `days` from now. */
function at11(t: MockTransport, days: number) {
  return new Date(istDayStart(addDays(istDateKey(t.now), days)) + 11 * HOUR).toISOString();
}

function book(t: MockTransport, auth: Auth, body: Record<string, unknown>) {
  return t.request({ method: 'POST', path: '/bookings', headers: auth, body: { address: '12 MG Road, Bangalore', ...body } });
}

describe('directory', () => {
  it('lists the six seeded artists without auth, newest approval first, with cursors', async () => {
    const t = new MockTransport();
    const all = await get<Page<ArtistCard>>(t, '/artists');
    expect(all.items).toHaveLength(6);
    expect(all.next_cursor).toBeNull();
    expect(all.items[0]).toMatchObject({ business_name: expect.any(String), city: expect.any(String), from_price_paise: expect.any(Number) });
    expect(all.items[0].cover_url).toMatch(/^https:\/\//);

    const first = await get<Page<ArtistCard>>(t, '/artists?limit=4');
    expect(first.items).toHaveLength(4);
    const rest = await get<Page<ArtistCard>>(t, `/artists?limit=4&cursor=${first.next_cursor}`);
    expect(rest.items).toHaveLength(2);
    expect([...first.items, ...rest.items].map((a) => a.id)).toEqual(all.items.map((a) => a.id));
  });

  it('filters by city, top-level category and a case-insensitive name or service match', async () => {
    const t = new MockTransport();
    const tree = await get<CatalogCategory[]>(t, '/categories');
    const makeup = tree.find((c) => c.name === 'Makeup')!;
    const byCat = await get<Page<ArtistCard>>(t, `/artists?category_id=${makeup.id}`);
    expect(byCat.items.length).toBeGreaterThan(0);
    expect(byCat.items.every((a) => a.categories.some((c) => c.id === makeup.id))).toBe(true);
    const mumbai = await get<Page<ArtistCard>>(t, '/artists?city=Mumbai');
    expect(mumbai.items.every((a) => a.city === 'Mumbai')).toBe(true);
    const q = await get<Page<ArtistCard>>(t, '/artists?q=airbrush');
    expect(q.items.length).toBeGreaterThan(0);
    const none = await get<Page<ArtistCard>>(t, '/artists?q=zzzz');
    expect(none.items).toEqual([]);
  });

  it('the storefront shows approved services only and never KYC; unknown or unapproved artists are 404', async () => {
    const t = new MockTransport();
    const list = await get<Page<ArtistCard>>(t, '/artists');
    const store = await get<ArtistPublic>(t, `/artists/${list.items[0].id}`);
    expect(store.services.length).toBeGreaterThan(0);
    expect(store.services[0]).toMatchObject({ subcategory: { name: expect.any(String) }, category: { name: expect.any(String) } });
    expect(store.photos.length).toBeGreaterThan(0);
    expect(store).not.toHaveProperty('kyc');
    expect(store).not.toHaveProperty('rejection_reason');
    expect(await t.request({ method: 'GET', path: '/artists/nope' })).toMatchObject({ status: 404, json: { code: 'not_found' } });

    const artist = await signIn(t, '+15550004444');
    await t.request({ method: 'PUT', path: '/users/me/role', headers: artist, body: { role: 'artist' } });
    const photo = (await t.request({ method: 'POST', path: '/uploads/signature', headers: artist, body: { purpose: 'artist_photo' } })).json as UploadTicket;
    const draft = (await t.request({ method: 'PUT', path: '/artists/me/profile', headers: artist, body: { business_name: 'Draft', city: 'Pune', category_ids: [1], photo_key: photo.key } })).json as { id: string };
    expect(await t.request({ method: 'GET', path: `/artists/${draft.id}` })).toMatchObject({ status: 404 });
  });

  it('availability is hourly IST, rejects past and far dates, and needs one of the artist’s services', async () => {
    const t = new MockTransport();
    const { id, store } = await priya(t);
    const date = addDays(istDateKey(t.now), 3);
    const res = await get<Availability>(t, `/artists/${id}/availability?date=${date}&service_id=${store.services[0].id}`);
    expect(res.date).toBe(date);
    expect(res.slots).toHaveLength(9);
    expect(res.slots.every((s) => s.available)).toBe(true);
    expect(istDateKey(res.slots[0].start_at)).toBe(date);
    for (const bad of [addDays(istDateKey(t.now), -1), addDays(istDateKey(t.now), 61)]) {
      expect(await t.request({ method: 'GET', path: `/artists/${id}/availability?date=${bad}&service_id=${store.services[0].id}` })).toMatchObject({ status: 422 });
    }
    expect(await t.request({ method: 'GET', path: `/artists/${id}/availability?date=${date}&service_id=nope` })).toMatchObject({ status: 422 });
  });
});

describe('customer bookings', () => {
  it('needs a signed-in customer', async () => {
    const t = new MockTransport();
    expect(await t.request({ method: 'GET', path: '/bookings?scope=upcoming' })).toMatchObject({ status: 401 });
    const { auth } = await priya(t); // holds only the artist role
    expect(await t.request({ method: 'GET', path: '/bookings?scope=upcoming', headers: auth })).toMatchObject({ status: 403, json: { code: 'forbidden' } });
  });

  it('creates a request with the deposit paid, the fee and the artist’s earning, then takes the slot', async () => {
    const t = new MockTransport();
    const { id, store } = await priya(t);
    const auth = await customer(t);
    const service = store.services[0];
    const start = at11(t, 4);
    const res = await book(t, auth, { artist_id: id, service_id: service.id, start_at: start, note: 'Lighter palms' });
    expect(res.status).toBe(201);
    const b = res.json as Booking;
    expect(b).toMatchObject({
      status: 'requested', start_at: start, service_name: service.name, duration_minutes: service.duration_minutes,
      artist: { id, business_name: 'Priya Bridal Studio' }, customer: { first_name: 'Ananya', last_name: 'Rao' },
      subtotal_paise: service.price_paise, note: 'Lighter palms', refund_due: null,
    });
    expect(b.code).toMatch(/^BK-[A-HJ-NP-Z2-9]{6}$/);
    expect(b.deposit_paid_at).not.toBeNull();
    expect(Date.parse(b.expires_at) - Date.parse(b.created_at)).toBe(3 * HOUR);
    expect(b.total_paise).toBe(b.subtotal_paise + b.platform_fee_paise);
    expect(b.balance_paise).toBe(b.total_paise - b.deposit_paise);

    const slots = await get<Availability>(t, `/artists/${id}/availability?date=${istDateKey(start)}&service_id=${service.id}`);
    expect(slots.slots.find((s) => s.start_at === start)?.available).toBe(false);

    const again = await book(t, await customer(t, '+919800022222'), { artist_id: id, service_id: service.id, start_at: start });
    expect(again).toMatchObject({ status: 409, json: { code: 'conflict', message: 'That time was just taken. Pick another slot.' } });
  });

  it('rejects starts that are not slots, empty addresses and other artists’ services', async () => {
    const t = new MockTransport();
    const { id, store } = await priya(t);
    const auth = await customer(t);
    const offSlot = new Date(Date.parse(at11(t, 4)) + 30 * 60_000).toISOString();
    expect(await book(t, auth, { artist_id: id, service_id: store.services[0].id, start_at: offSlot })).toMatchObject({ status: 409 });
    expect(await book(t, auth, { artist_id: id, service_id: store.services[0].id, start_at: at11(t, 4), address: '  ' })).toMatchObject({ status: 422 });
    const other = (await get<Page<ArtistCard>>(t, '/artists')).items.find((a) => a.id !== id)!;
    const otherStore = await get<ArtistPublic>(t, `/artists/${other.id}`);
    expect(await book(t, auth, { artist_id: id, service_id: otherStore.services[0].id, start_at: at11(t, 4) })).toMatchObject({ status: 422 });
    expect(await book(t, auth, { artist_id: 'nope', service_id: otherStore.services[0].id, start_at: at11(t, 4) })).toMatchObject({ status: 404 });
  });

  it('an artist can’t book their own profile', async () => {
    const t = new MockTransport();
    const { auth, id, store } = await priya(t);
    await t.request({ method: 'PUT', path: '/users/me/role', headers: auth, body: { role: 'customer' } });
    expect(await book(t, auth, { artist_id: id, service_id: store.services[0].id, start_at: at11(t, 4) })).toMatchObject({ status: 422 });
  });

  it('lists upcoming and past scopes, and hides other customers’ bookings', async () => {
    const t = new MockTransport();
    const { id, store } = await priya(t);
    const auth = await customer(t);
    const later = (await book(t, auth, { artist_id: id, service_id: store.services[0].id, start_at: at11(t, 6) })).json as Booking;
    const sooner = (await book(t, auth, { artist_id: id, service_id: store.services[0].id, start_at: at11(t, 5) })).json as Booking;
    const upcoming = await get<Page<Booking>>(t, '/bookings?scope=upcoming', auth);
    expect(upcoming.items.map((b) => b.id)).toEqual([sooner.id, later.id]);
    expect((await get<Page<Booking>>(t, '/bookings?scope=past', auth)).items).toEqual([]);

    const stranger = await customer(t, '+919800033333');
    expect(await t.request({ method: 'GET', path: `/bookings/${sooner.id}`, headers: stranger })).toMatchObject({ status: 404 });
    expect(await t.request({ method: 'POST', path: `/bookings/${sooner.id}/cancel`, headers: stranger, body: {} })).toMatchObject({ status: 404 });
    expect((await get<Page<Booking>>(t, '/bookings?scope=upcoming', stranger)).items).toEqual([]);
  });

  it('cancelling 72h+ ahead is refunded, later is not, and a second cancel conflicts', async () => {
    const t = new MockTransport();
    const { id, store } = await priya(t);
    const auth = await customer(t);
    const far = (await book(t, auth, { artist_id: id, service_id: store.services[0].id, start_at: at11(t, 10) })).json as Booking;
    const res = await t.request({ method: 'POST', path: `/bookings/${far.id}/cancel`, headers: auth, body: { reason: 'Plans changed' } });
    expect(res.json).toMatchObject({ status: 'cancelled', cancelled_by: 'customer', cancel_reason: 'Plans changed', refund_due: true });
    expect(await t.request({ method: 'POST', path: `/bookings/${far.id}/cancel`, headers: auth, body: {} }))
      .toMatchObject({ status: 409, json: { code: 'conflict', message: 'This booking is already cancelled' } });
    expect((await get<Page<Booking>>(t, '/bookings?scope=past', auth)).items.map((b) => b.id)).toEqual([far.id]);

    const near = (await book(t, auth, { artist_id: id, service_id: store.services[0].id, start_at: at11(t, 2) })).json as Booking;
    const late = await t.request({ method: 'POST', path: `/bookings/${near.id}/cancel`, headers: auth, body: {} });
    expect(late.json).toMatchObject({ status: 'cancelled', refund_due: false });
  });

  it('an unanswered request expires after 3 hours on the mock clock and frees its slot', async () => {
    const t = new MockTransport();
    const { id, store } = await priya(t);
    const auth = await customer(t);
    const start = at11(t, 5);
    const b = (await book(t, auth, { artist_id: id, service_id: store.services[0].id, start_at: start })).json as Booking;
    t.advanceTime(3 * HOUR + 1000);
    expect(await get<Booking>(t, `/bookings/${b.id}`, auth)).toMatchObject({ status: 'expired', refund_due: true });
    const slots = await get<Availability>(t, `/artists/${id}/availability?date=${istDateKey(start)}&service_id=${store.services[0].id}`);
    expect(slots.slots.find((s) => s.start_at === start)?.available).toBe(true);
  });
});

describe('artist bookings', () => {
  it('a profile that isn’t approved gets a conflict', async () => {
    const t = new MockTransport();
    const auth = await signIn(t, '+15550004444');
    await t.request({ method: 'PUT', path: '/users/me/role', headers: auth, body: { role: 'artist' } });
    const photo = (await t.request({ method: 'POST', path: '/uploads/signature', headers: auth, body: { purpose: 'artist_photo' } })).json as UploadTicket;
    await t.request({ method: 'PUT', path: '/artists/me/profile', headers: auth, body: { business_name: 'Draft', city: 'Pune', category_ids: [1], photo_key: photo.key } });
    expect(await t.request({ method: 'GET', path: '/artists/me/bookings', headers: auth })).toMatchObject({ status: 409, json: { code: 'conflict' } });
    expect(await t.request({ method: 'GET', path: '/artists/me/dashboard', headers: auth })).toMatchObject({ status: 409 });
  });

  it('requests can be accepted, declined and completed once started; other moves conflict', async () => {
    const t = new MockTransport();
    const { auth } = await priya(t);
    const a = t.requestBooking('+919800044444', PRIYA, { startAt: at11(t, 1), note: 'Our date on the wrist' });
    const b = t.requestBooking('+919800055555', PRIYA, { startAt: at11(t, 2) });
    expect(a.customer.first_name).toBeTruthy();

    const requests = await get<Page<Booking>>(t, '/artists/me/bookings?scope=requests', auth);
    expect(requests.items.map((x) => x.id)).toEqual([a.id, b.id]); // by expires_at

    const accepted = await t.request({ method: 'POST', path: `/artists/me/bookings/${a.id}/accept`, headers: auth });
    expect(accepted.json).toMatchObject({ status: 'confirmed' });
    expect(await t.request({ method: 'POST', path: `/artists/me/bookings/${a.id}/accept`, headers: auth }))
      .toMatchObject({ status: 409, json: { message: 'This booking is already confirmed' } });
    const declined = await t.request({ method: 'POST', path: `/artists/me/bookings/${b.id}/decline`, headers: auth, body: { reason: 'Fully booked' } });
    expect(declined.json).toMatchObject({ status: 'declined', decline_reason: 'Fully booked', refund_due: true });

    expect((await get<Page<Booking>>(t, '/artists/me/bookings?scope=upcoming', auth)).items.map((x) => x.id)).toContain(a.id);
    expect((await get<Page<Booking>>(t, '/artists/me/bookings?scope=past', auth)).items.map((x) => x.id)).toContain(b.id);

    expect(await t.request({ method: 'POST', path: `/artists/me/bookings/${a.id}/complete`, headers: auth })).toMatchObject({ status: 409 });
    t.advanceTime(2 * 24 * HOUR);
    expect((await t.request({ method: 'POST', path: `/artists/me/bookings/${a.id}/complete`, headers: auth })).json).toMatchObject({ status: 'completed' });
  });

  it('another artist’s booking is 404, and from/to filter on the IST start date', async () => {
    const t = new MockTransport();
    const { auth } = await priya(t);
    const a = t.requestBooking('+919800044444', PRIYA, { startAt: at11(t, 3) });
    const day = istDateKey(a.start_at);
    expect((await get<Page<Booking>>(t, `/artists/me/bookings?from=${day}&to=${day}`, auth)).items.map((x) => x.id)).toContain(a.id);
    expect((await get<Page<Booking>>(t, `/artists/me/bookings?from=${addDays(day, 1)}&to=${addDays(day, 5)}`, auth)).items.map((x) => x.id)).not.toContain(a.id);

    const other = await signIn(t, '+919900000002'); // another seeded, approved artist
    expect(await t.request({ method: 'POST', path: `/artists/me/bookings/${a.id}/decline`, headers: other, body: {} })).toMatchObject({ status: 404 });
    expect((await get<Page<Booking>>(t, '/artists/me/bookings', other)).items.map((x) => x.id)).not.toContain(a.id);
    expect(await t.request({ method: 'POST', path: `/artists/me/bookings/${a.id}/accept`, headers: auth })).toMatchObject({ status: 200 });
  });

  it('the dashboard counts requests, upcoming and this month’s completed earnings', async () => {
    const t = new MockTransport();
    const { auth } = await priya(t);
    const before = await get<ArtistDashboard>(t, '/artists/me/dashboard', auth);
    const a = t.requestBooking('+919800044444', PRIYA, { startAt: at11(t, 1) });
    t.requestBooking('+919800055555', PRIYA, { startAt: at11(t, 2) });
    await t.request({ method: 'POST', path: `/artists/me/bookings/${a.id}/accept`, headers: auth });
    const mid = await get<ArtistDashboard>(t, '/artists/me/dashboard', auth);
    expect(mid.requests).toBe(before.requests + 1);
    expect(mid.upcoming).toBe(before.upcoming + 1);
    expect(Array.isArray(mid.today)).toBe(true);
  });

  it('an artist approved through review() shows up in the directory and can be booked', async () => {
    const t = new MockTransport();
    const phone = '+15550007777';
    const auth = await signIn(t, phone);
    await t.request({ method: 'PUT', path: '/users/me/role', headers: auth, body: { role: 'artist' } });
    const ticket = async (purpose: string) => ((await t.request({ method: 'POST', path: '/uploads/signature', headers: auth, body: { purpose } })).json as UploadTicket).key;
    await t.request({ method: 'PUT', path: '/artists/me/profile', headers: auth, body: { business_name: 'Fresh Face Studio', city: 'Pune', category_ids: [2], photo_key: await ticket('artist_photo') } });
    const tree = await get<CatalogCategory[]>(t, '/categories');
    const party = tree[1].subcategories.find((s) => s.name === 'Party')!.services[0];
    await t.request({ method: 'POST', path: '/artists/me/services', headers: auth, body: { template_id: party.id, price_paise: 300_000, duration_minutes: 90 } });
    for (let i = 0; i < 6; i++) await t.request({ method: 'POST', path: '/artists/me/photos', headers: auth, body: { key: await ticket('portfolio'), width: 10, height: 10 } });
    const front = await ticket('aadhaar');
    const back = await ticket('aadhaar');
    await t.request({ method: 'PUT', path: '/artists/me/kyc', headers: auth, body: { aadhaar_number: '234123412346', front_key: front, back_key: back } });
    await t.request({ method: 'POST', path: '/artists/me/submit', headers: auth });
    expect((await get<Page<ArtistCard>>(t, '/artists?q=fresh')).items).toEqual([]);
    t.review(phone, 'approved');
    const found = (await get<Page<ArtistCard>>(t, '/artists?q=fresh')).items;
    expect(found).toHaveLength(1);
    expect(found[0].from_price_paise).toBe(300_000);
    const req = t.requestBooking('+919800044444', phone);
    expect(req.status).toBe('requested');
    expect((await get<Page<Booking>>(t, '/artists/me/bookings?scope=requests', auth)).items.map((x) => x.id)).toEqual([req.id]);
  });
});

describe('contract update (final backend)', () => {
  it('customer responses hide commission and earning; artist responses carry them, with lifecycle stamps', async () => {
    const t = new MockTransport();
    const { auth: artistAuth, id, store } = await priya(t);
    const auth = await customer(t);
    const created = (await book(t, auth, { artist_id: id, service_id: store.services[0].id, start_at: at11(t, 5) })).json as Booking;
    expect(created).toMatchObject({ commission_paise: null, artist_earning_paise: null, responded_at: null, cancelled_at: null, completed_at: null });
    expect((await get<Page<Booking>>(t, '/bookings?scope=upcoming', auth)).items[0]).toMatchObject({ commission_paise: null, artist_earning_paise: null });
    expect(await get<Booking>(t, `/bookings/${created.id}`, auth)).toMatchObject({ artist_earning_paise: null });

    const accepted = (await t.request({ method: 'POST', path: `/artists/me/bookings/${created.id}/accept`, headers: artistAuth })).json as Booking;
    expect(accepted.commission_paise).toBe(Math.round(store.services[0].price_paise / 10));
    expect(accepted.artist_earning_paise).toBe(store.services[0].price_paise - accepted.commission_paise!);
    expect(accepted.responded_at).not.toBeNull();
    const cancelled = (await t.request({ method: 'POST', path: `/bookings/${created.id}/cancel`, headers: auth, body: {} })).json as Booking;
    expect(cancelled).toMatchObject({ commission_paise: null, cancelled_at: expect.any(String) });
  });

  it('a customer may have at most 3 unanswered requests', async () => {
    const t = new MockTransport();
    const { id, store } = await priya(t);
    const auth = await customer(t);
    for (const d of [3, 4, 5]) expect((await book(t, auth, { artist_id: id, service_id: store.services[0].id, start_at: at11(t, d) })).status).toBe(201);
    expect(await book(t, auth, { artist_id: id, service_id: store.services[0].id, start_at: at11(t, 6) })).toMatchObject({
      status: 409, json: { code: 'conflict', message: 'You have 3 requests waiting for an answer. Wait for a reply or cancel one first.' },
    });
    t.advanceTime(3 * HOUR + 1000); // all three expire, so they no longer count
    expect((await book(t, auth, { artist_id: id, service_id: store.services[0].id, start_at: at11(t, 6) })).status).toBe(201);
  });

  it('a request starting within 3 hours must be answered before it starts', async () => {
    const t = new MockTransport();
    const { id, store } = await priya(t);
    const auth = await customer(t);
    // The earliest slot at least 2h away: its start is within the 3h window.
    const date = istDateKey(t.now);
    let slots = await get<Availability>(t, `/artists/${id}/availability?date=${date}&service_id=${store.services[1].id}`);
    let first = slots.slots.find((s) => s.available && Date.parse(s.start_at) - t.now < 3 * HOUR);
    if (!first) { // too late in the IST day: jump the clock to 06:30 IST tomorrow, so 09:00 is 2.5h away
      t.advanceTime(istDayStart(addDays(date, 1)) + 6.5 * HOUR - t.now);
      slots = await get<Availability>(t, `/artists/${id}/availability?date=${addDays(date, 1)}&service_id=${store.services[1].id}`);
      first = slots.slots.find((s) => s.available)!;
    }
    const b = (await book(t, auth, { artist_id: id, service_id: store.services[1].id, start_at: first.start_at })).json as Booking;
    expect(b.expires_at).toBe(first.start_at);
  });

  it('whitespace-only cancel and decline reasons are rejected', async () => {
    const t = new MockTransport();
    const { auth: artistAuth, id, store } = await priya(t);
    const auth = await customer(t);
    const b = (await book(t, auth, { artist_id: id, service_id: store.services[0].id, start_at: at11(t, 5) })).json as Booking;
    expect(await t.request({ method: 'POST', path: `/bookings/${b.id}/cancel`, headers: auth, body: { reason: '   ' } })).toMatchObject({ status: 422 });
    expect(await t.request({ method: 'POST', path: `/artists/me/bookings/${b.id}/decline`, headers: artistAuth, body: { reason: ' ' } })).toMatchObject({ status: 422 });
    expect((await t.request({ method: 'POST', path: `/artists/me/bookings/${b.id}/decline`, headers: artistAuth, body: {} })).json).toMatchObject({ status: 'declined' });
  });
});
