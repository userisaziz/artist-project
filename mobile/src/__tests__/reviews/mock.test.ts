import { MockTransport } from '../../mocks/transport';
import { summarize } from '../../mocks/reviews/reviews';
import type { Page } from '../../core/api/types';
import type { ArtistProfile } from '../../types/artist-onboarding/artist-onboarding';
import type { Booking } from '../../types/bookings/bookings';
import type { CatalogCategory } from '../../types/catalog/catalog';
import type { ArtistCard, ArtistPublic } from '../../types/directory/directory';
import type { ArtistReview, PostedReview, Review, ReviewPage } from '../../types/reviews/reviews';

const DAY = 24 * 3600_000;
const PRIYA = '+15550009999';
const AYESHA = '+919900000002';
const KAVYA = '+919900000003';
const CUSTOMER = '+919800011111';

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

const get = async <T>(t: MockTransport, path: string, headers?: Auth) => (await t.request({ method: 'GET', path, headers })).json as T;
const review = (t: MockTransport, auth: Auth, bookingId: string, body: Record<string, unknown>) =>
  t.request({ method: 'POST', path: `/bookings/${bookingId}/review`, headers: auth, body });

async function artistId(t: MockTransport, name: string): Promise<string> {
  const page = await get<Page<ArtistCard>>(t, '/artists');
  return page.items.find((a) => a.business_name === name)!.id;
}

/** A customer (Ananya Rao) with a booking with `artistPhone` completed `daysAgo` days ago on the mock clock. */
async function completed(t: MockTransport, artistPhone = AYESHA, daysAgo = 1, phone = CUSTOMER) {
  const booking = t.completedBooking(phone, artistPhone, { daysAgo, firstName: 'Ananya', lastName: 'Rao' });
  const auth = await signIn(t, phone);
  return { auth, booking };
}

describe('posting a review', () => {
  it('the customer of a completed booking can review it once, and the booking says so', async () => {
    const t = new MockTransport();
    const { auth, booking } = await completed(t);
    expect(booking).toMatchObject({ status: 'completed', review: null, can_review: true });

    const res = await review(t, auth, booking.id, { rating: 5, text: '  Calm, on time and so detailed.  ' });
    expect(res.status).toBe(201);
    expect(res.json).toMatchObject({
      rating: 5, text: 'Calm, on time and so detailed.', reviewer_name: 'Ananya R.', service_name: booking.service_name,
      reply: null, replied_at: null, status: 'published',
    });
    const posted = res.json as PostedReview;
    expect(await get<Booking>(t, `/bookings/${booking.id}`, auth)).toMatchObject({ review: { id: posted.id, rating: 5, status: 'published' }, can_review: false });
    expect(await review(t, auth, booking.id, { rating: 4 })).toMatchObject({ status: 409, json: { code: 'conflict' } });
  });

  it('text is optional; the rating must be a whole number from 1 to 5 and text at most 1000 characters', async () => {
    const t = new MockTransport();
    const { auth, booking } = await completed(t);
    for (const rating of [0, 6, 4.5, undefined]) {
      expect(await review(t, auth, booking.id, { rating })).toMatchObject({ status: 422, json: { code: 'validation_error' } });
    }
    expect(await review(t, auth, booking.id, { rating: 4, text: 'x'.repeat(1001) })).toMatchObject({ status: 422 });
    const res = await review(t, auth, booking.id, { rating: 4, text: '   ' });
    expect(res).toMatchObject({ status: 201, json: { rating: 4, text: null, status: 'published' } });
  });

  it('refuses bookings that are not completed (409) and other customers’ bookings (404)', async () => {
    const t = new MockTransport();
    const upcoming = t.requestBooking(CUSTOMER, AYESHA, { firstName: 'Ananya', lastName: 'Rao' });
    const auth = await signIn(t, CUSTOMER);
    expect(await get<Booking>(t, `/bookings/${upcoming.id}`, auth)).toMatchObject({ review: null, can_review: false });
    expect(await review(t, auth, upcoming.id, { rating: 5 })).toMatchObject({ status: 409, json: { code: 'conflict' } });

    const other = t.completedBooking('+919800022222', AYESHA);
    expect(await review(t, auth, other.id, { rating: 5 })).toMatchObject({ status: 404, json: { code: 'not_found' } });
    expect(await review(t, auth, 'nope', { rating: 5 })).toMatchObject({ status: 404 });
  });

  it('reviews open for 30 days after completion, on the mock clock', async () => {
    const t = new MockTransport();
    const { auth, booking } = await completed(t, AYESHA, 0);
    t.advanceTime(30 * DAY - 120_000);
    expect(await get<Booking>(t, `/bookings/${booking.id}`, auth)).toMatchObject({ can_review: true });
    t.advanceTime(2 * DAY);
    expect(await get<Booking>(t, `/bookings/${booking.id}`, auth)).toMatchObject({ can_review: false });
    expect(await review(t, auth, booking.id, { rating: 5 })).toMatchObject({
      status: 409, json: { code: 'conflict', message: 'Reviews open for 30 days after the booking' },
    });
  });

  it('text with contact details or a blocked word is hidden with its flag, and never public', async () => {
    const t = new MockTransport();
    const id = await artistId(t, 'Ayesha Mehendi Art');
    const before = await get<ReviewPage<Review>>(t, `/artists/${id}/reviews`);

    const a = await completed(t, AYESHA, 1, '+919800011111');
    const b = await completed(t, AYESHA, 1, '+919800011112');
    const phone = await review(t, a.auth, a.booking.id, { rating: 5, text: 'Call 98450 12345 to book her directly' });
    const blocked = await review(t, b.auth, b.booking.id, { rating: 1, text: 'Total scam' });
    expect(phone).toMatchObject({ status: 201, json: { status: 'hidden', flag: 'contact_info', report_reason: null } });
    expect(blocked).toMatchObject({ status: 201, json: { status: 'hidden' } });

    const after = await get<ReviewPage<Review>>(t, `/artists/${id}/reviews`);
    expect(after.summary).toEqual(before.summary);
    expect(after.items.map((r) => r.id)).toEqual(before.items.map((r) => r.id));

    const ayesha = await signIn(t, AYESHA);
    const mine = await get<ReviewPage<ArtistReview>>(t, '/artists/me/reviews', ayesha);
    expect(mine.items.find((r) => r.id === (phone.json as PostedReview).id)).toMatchObject({ status: 'hidden', flag: 'contact_info' });
    expect(mine.items.find((r) => r.id === (blocked.json as PostedReview).id)).toMatchObject({ status: 'hidden', flag: 'blocked_word' });
  });
});

describe('public reviews and ratings', () => {
  it('seeds reviews for every seeded artist, including one hidden and one flagged', async () => {
    const t = new MockTransport();
    const cards = (await get<Page<ArtistCard>>(t, '/artists')).items;
    expect(cards).toHaveLength(6);
    for (const card of cards) {
      expect(card.review_count).toBeGreaterThan(0);
      expect(card.rating).toEqual(expect.any(Number));
    }
    const statuses: string[] = [];
    for (const phone of [PRIYA, AYESHA, KAVYA, '+919900000004', '+919900000005', '+919900000006']) {
      const auth = await signIn(t, phone);
      statuses.push(...(await get<ReviewPage<ArtistReview>>(t, '/artists/me/reviews', auth)).items.map((r) => r.status));
    }
    expect(statuses.filter((s) => s === 'hidden')).toHaveLength(1);
    expect(statuses.filter((s) => s === 'flagged')).toHaveLength(1);
  });

  it('lists public reviews newest first with cursors, and a summary that matches the cards and the storefront', async () => {
    const t = new MockTransport();
    const id = await artistId(t, 'Ayesha Mehendi Art');
    for (const [i, rating] of [3, 4, 5].entries()) {
      const { auth, booking } = await completed(t, AYESHA, 1, `+91980003333${i}`);
      t.advanceTime(1000);
      await review(t, auth, booking.id, { rating, text: `Review ${i}` });
    }
    const all = await get<ReviewPage<Review>>(t, `/artists/${id}/reviews`);
    expect(all.items.slice(0, 3).map((r) => r.text)).toEqual(['Review 2', 'Review 1', 'Review 0']);
    expect(Object.keys(all.items[0]).sort()).toEqual(['created_at', 'id', 'rating', 'replied_at', 'reply', 'reviewer_name', 'service_name', 'text']);

    const ratings = all.items.map((r) => r.rating);
    const { summary } = all;
    expect(summary.count).toBe(ratings.length);
    expect(summary.average).toBe(Math.round((ratings.reduce((s, r) => s + r, 0) / ratings.length) * 10) / 10);
    expect([5, 4, 3, 2, 1].reduce((s, n) => s + summary.distribution[String(n) as '5'], 0)).toBe(ratings.length);
    expect(summary.distribution['3']).toBe(ratings.filter((r) => r === 3).length);

    const first = await get<ReviewPage<Review>>(t, `/artists/${id}/reviews?limit=2`);
    expect(first.items).toHaveLength(2);
    expect(first.summary).toEqual(summary);
    const rest = await get<ReviewPage<Review>>(t, `/artists/${id}/reviews?limit=50&cursor=${first.next_cursor}`);
    expect([...first.items, ...rest.items].map((r) => r.id)).toEqual(all.items.map((r) => r.id));
    expect(rest.next_cursor).toBeNull();

    const card = (await get<Page<ArtistCard>>(t, '/artists')).items.find((a) => a.id === id)!;
    expect(card).toMatchObject({ rating: summary.average, review_count: summary.count });
    expect(await get<ArtistPublic>(t, `/artists/${id}`)).toMatchObject({ rating: summary.average, review_count: summary.count });
  });

  it('unknown artists are 404', async () => {
    const t = new MockTransport();
    expect(await t.request({ method: 'GET', path: '/artists/nope/reviews' })).toMatchObject({ status: 404, json: { code: 'not_found' } });
  });
});

describe('summary', () => {
  it('averages round half up to one decimal, and an empty summary has a null average', () => {
    expect(summarize([4, 4, 5, 4]).average).toBe(4.3); // 4.25
    expect(summarize([5, 4, 4]).average).toBe(4.3); // 4.333…
    expect(summarize([1, 2]).average).toBe(1.5);
    expect(summarize([])).toEqual({ average: null, count: 0, distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } });
  });
});

describe('reviews on the artist’s bookings', () => {
  it('artists see a booking’s review only once it is public; the customer sees theirs in any state', async () => {
    const t = new MockTransport();
    const clean = t.completedBooking('+919800044441', AYESHA, { review: { rating: 5, text: 'Lovely' } });
    const hidden = t.completedBooking('+919800044442', AYESHA, { review: { rating: 4, text: 'Call 98450 12345' } });
    expect(hidden.review).toMatchObject({ status: 'hidden' });
    const ayesha = await signIn(t, AYESHA);
    const past = await get<Page<Booking>>(t, '/artists/me/bookings?scope=past&limit=100', ayesha);
    expect(past.items.find((b) => b.id === clean.id)).toMatchObject({ review: { rating: 5, status: 'published' }, can_review: false });
    expect(past.items.find((b) => b.id === hidden.id)).toMatchObject({ review: null });
  });
});

describe('artist replies and reports', () => {
  async function setup() {
    const t = new MockTransport();
    const { auth, booking } = await completed(t, PRIYA);
    const posted = (await review(t, auth, booking.id, { rating: 2, text: 'Arrived late' })).json as PostedReview;
    const priya = await signIn(t, PRIYA);
    return { t, priya, posted };
  }

  it('the artist sees every review except removed ones, with its status, flag and report reason', async () => {
    const { t, priya, posted } = await setup();
    const mine = await get<ReviewPage<ArtistReview>>(t, '/artists/me/reviews', priya);
    expect(mine.items[0]).toMatchObject({ id: posted.id, status: 'published', flag: null, report_reason: null });
    expect(mine.summary.count).toBeGreaterThan(0);
    const customer = await signIn(t, CUSTOMER);
    expect(await t.request({ method: 'GET', path: '/artists/me/reviews', headers: customer })).toMatchObject({ status: 403 });
  });

  it('reply, edit the reply and clear it with an empty string; 500 characters at most', async () => {
    const { t, priya, posted } = await setup();
    const reply = (text: string) => t.request({ method: 'PUT', path: `/artists/me/reviews/${posted.id}/reply`, headers: priya, body: { text } });
    expect(await reply('x'.repeat(501))).toMatchObject({ status: 422 });
    const first = await reply('  Sorry, traffic was awful that day.  ');
    expect(first).toMatchObject({ status: 200, json: { reply: 'Sorry, traffic was awful that day.', replied_at: expect.any(String), status: 'published' } });
    expect((await reply('Sorry about the delay.')).json).toMatchObject({ reply: 'Sorry about the delay.' });
    const id = await artistId(t, 'Priya Bridal Studio');
    const pub = await get<ReviewPage<Review>>(t, `/artists/${id}/reviews`);
    expect(pub.items.find((r) => r.id === posted.id)).toMatchObject({ reply: 'Sorry about the delay.' });
    expect((await reply('')).json).toMatchObject({ reply: null, replied_at: null });
  });

  it('replies with contact details or blocked words are refused', async () => {
    const { t, priya, posted } = await setup();
    const reply = (text: string) => t.request({ method: 'PUT', path: `/artists/me/reviews/${posted.id}/reply`, headers: priya, body: { text } });
    const refused = { status: 422, json: { code: 'validation_error', message: "Replies can't include phone numbers, emails, links or blocked words" } };
    expect(await reply('WhatsApp me on 98450 12345')).toMatchObject(refused);
    expect(await reply('See priyastudio.in')).toMatchObject(refused);
    expect(await reply('That is a scam claim')).toMatchObject(refused);
    expect(await reply('Sorry, see you at 11 AM on 15-10-2026')).toMatchObject({ status: 200 });
  });

  it('report needs a reason, flags a published review (still public) and only works once', async () => {
    const { t, priya, posted } = await setup();
    const report = (body: Record<string, unknown>) => t.request({ method: 'POST', path: `/artists/me/reviews/${posted.id}/report`, headers: priya, body });
    expect(await report({ reason: '  ' })).toMatchObject({ status: 422 });
    expect(await report({ reason: 'She never booked this service' })).toMatchObject({
      status: 200, json: { status: 'flagged', flag: 'artist_report', report_reason: 'She never booked this service' },
    });
    expect(await report({ reason: 'Again' })).toMatchObject({ status: 409, json: { code: 'conflict' } });
    const id = await artistId(t, 'Priya Bridal Studio');
    expect((await get<ReviewPage<Review>>(t, `/artists/${id}/reviews`)).items.map((r) => r.id)).toContain(posted.id);
  });

  it('another artist’s review is 404', async () => {
    const { t, posted } = await setup();
    const ayesha = await signIn(t, AYESHA);
    expect(await t.request({ method: 'PUT', path: `/artists/me/reviews/${posted.id}/reply`, headers: ayesha, body: { text: 'Hi' } })).toMatchObject({ status: 404 });
    expect(await t.request({ method: 'POST', path: `/artists/me/reviews/${posted.id}/report`, headers: ayesha, body: { reason: 'x' } })).toMatchObject({ status: 404 });
  });
});

describe('custom services', () => {
  async function priya() {
    const t = new MockTransport();
    const auth = await signIn(t, PRIYA);
    const tree = await get<CatalogCategory[]>(t, '/categories');
    const arabic = tree.find((c) => c.name === 'Mehendi')!.subcategories.find((s) => s.name === 'Arabic')!;
    return { t, auth, tree, arabic };
  }
  const body = (subcategory_id: number) => ({ subcategory_id, name: ' Glitter Arabic ', price_paise: 250_000, duration_minutes: 75 });

  it('add (201) a pending custom service, edit it back to review, delete it', async () => {
    const { t, auth, arabic } = await priya();
    const added = await t.request({ method: 'POST', path: '/artists/me/custom-services', headers: auth, body: { ...body(arabic.id), description: 'Gold glitter outline' } });
    expect(added.status).toBe(201);
    const svc = (added.json as ArtistProfile).services.find((s) => s.name === 'Glitter Arabic')!;
    expect(svc).toMatchObject({ template_id: null, subcategory_id: arabic.id, status: 'pending', price_paise: 250_000, duration_minutes: 75, description: 'Gold glitter outline', rejection_reason: null });

    t.reviewCustomService(PRIYA, svc.id, 'rejected', 'Name it for what it is');
    expect((await get<ArtistProfile>(t, '/artists/me', auth)).services.find((s) => s.id === svc.id)).toMatchObject({ status: 'rejected', rejection_reason: 'Name it for what it is' });

    const edited = await t.request({ method: 'PATCH', path: `/artists/me/custom-services/${svc.id}`, headers: auth, body: { price_paise: 300_000 } });
    expect((edited.json as ArtistProfile).services.find((s) => s.id === svc.id)).toMatchObject({ price_paise: 300_000, name: 'Glitter Arabic', status: 'pending', rejection_reason: null });

    const removed = await t.request({ method: 'DELETE', path: `/artists/me/custom-services/${svc.id}`, headers: auth });
    expect(removed.status).toBe(200);
    expect((removed.json as ArtistProfile).services.some((s) => s.id === svc.id)).toBe(false);
  });

  it('pending custom services stay off the storefront; approved ones go live', async () => {
    const { t, auth, arabic } = await priya();
    const svc = ((await t.request({ method: 'POST', path: '/artists/me/custom-services', headers: auth, body: body(arabic.id) })).json as ArtistProfile)
      .services.find((s) => s.template_id === null)!;
    const id = await artistId(t, 'Priya Bridal Studio');
    expect((await get<ArtistPublic>(t, `/artists/${id}`)).services.some((s) => s.id === svc.id)).toBe(false);
    t.reviewCustomService(PRIYA, svc.id, 'approved');
    expect((await get<ArtistPublic>(t, `/artists/${id}`)).services.some((s) => s.id === svc.id)).toBe(true);
  });

  it('validates the subcategory, name, price and duration; services from the admin list are not custom', async () => {
    const { t, auth, tree, arabic } = await priya();
    const post = (b: Record<string, unknown>) => t.request({ method: 'POST', path: '/artists/me/custom-services', headers: auth, body: b });
    expect(await post({ ...body(arabic.id), subcategory_id: tree[0].id })).toMatchObject({ status: 422, json: { message: 'Unknown subcategory' } });
    expect(await post({ ...body(arabic.id), name: '   ' })).toMatchObject({ status: 422 });
    expect(await post({ ...body(arabic.id), name: 'x'.repeat(121) })).toMatchObject({ status: 422 });
    expect(await post({ ...body(arabic.id), price_paise: 0 })).toMatchObject({ status: 422 });
    expect(await post({ ...body(arabic.id), duration_minutes: 1441 })).toMatchObject({ status: 422 });
    const me = await get<ArtistProfile>(t, '/artists/me', auth);
    const fromList = me.services.find((s) => s.template_id !== null)!;
    expect(await t.request({ method: 'PATCH', path: `/artists/me/custom-services/${fromList.id}`, headers: auth, body: { price_paise: 100 } })).toMatchObject({ status: 404 });
    expect(await t.request({ method: 'DELETE', path: `/artists/me/custom-services/${fromList.id}`, headers: auth })).toMatchObject({ status: 404 });
  });

  it('only approved artists can add custom services', async () => {
    const t = new MockTransport();
    const auth = await signIn(t, '+15550004444');
    await t.request({ method: 'PUT', path: '/users/me/role', headers: auth, body: { role: 'artist' } });
    await t.request({ method: 'PUT', path: '/artists/me/profile', headers: auth, body: { business_name: 'New', city: 'Bangalore', category_ids: [1], photo_key: null } });
    const tree = await get<CatalogCategory[]>(t, '/categories');
    const res = await t.request({ method: 'POST', path: '/artists/me/custom-services', headers: auth, body: body(tree[0].subcategories[0].id) });
    expect(res).toMatchObject({ status: 409, json: { message: 'Custom services open once your profile is approved' } });
  });
});
