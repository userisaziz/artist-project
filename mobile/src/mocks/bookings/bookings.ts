import type { ServiceItem } from '../../types/artist-onboarding/artist-onboarding';
import type { Booking, BookingStatus, CancelledBy } from '../../types/bookings/bookings';
import type { BookingReview } from '../../types/reviews/reviews';
import type { User } from '../../types/auth/auth';
import type { TransportResponse } from '../../core/api/transport';
import type { MockArtists, MockProfile } from '../artist-onboarding/artist-onboarding';
import { ACCEPT_WINDOW_HOURS, isBookableDate, isSlotFree, priceBreakdown, refundDueOnCustomerCancel, slotStarts } from '../../utils/bookings/pricing';
import type { Busy, PriceBreakdown } from '../../utils/bookings/pricing';
import { addDays, istDateKey, istDayStart } from '../../utils/common/time';

// Same rules as backend services/booking_service.py (spec §1.2, §1.4, §1.5) — keep them in lockstep.

const HOUR_MS = 3600_000;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const MAX_ADDRESS = 300;
const MAX_TEXT = 500;
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I/L
const ACTIVE: BookingStatus[] = ['requested', 'confirmed'];
const TAKEN = 'That time was just taken. Pick another slot.';
const MAX_OPEN_REQUESTS = 3; // per customer, requested and not yet expired
const TOO_MANY = `You have ${MAX_OPEN_REQUESTS} requests waiting for an answer. Wait for a reply or cancel one first.`;

/** Who a response is for: customers never see the commission or the artist's earning. */
export type BookingView = 'customer' | 'artist';

export interface MockBooking {
  id: string; code: string; status: BookingStatus;
  customerId: string; artistId: string; serviceId: string | null;
  serviceName: string; durationMinutes: number;
  start: number; end: number;
  address: string; note: string | null;
  money: PriceBreakdown;
  depositPaidAt: number | null; expiresAt: number;
  respondedAt: number | null; cancelledAt: number | null; completedAt: number | null;
  cancelledBy: CancelledBy | null; declineReason: string | null; cancelReason: string | null;
  refundDue: boolean | null; createdAt: number;
}

type Body = Record<string, unknown>;
type Query = Record<string, string>;

const err = (code: string, message: string, status: number): TransportResponse => ({ status, json: { code, message } });
const iso = (ms: number | null) => (ms === null ? null : new Date(ms).toISOString());
const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const optional = (v: unknown) => text(v) || null;
const already = (b: MockBooking) => err('conflict', `This booking is already ${b.status}`, 409);

/** An optional reason: absent or null is fine; a blank or over-long one is a validation error. */
function reasonOf(v: unknown): { reason: string | null } | { error: TransportResponse } {
  if (v === undefined || v === null) return { reason: null };
  const reason = text(v);
  if (!reason || reason.length > MAX_TEXT) return { error: err('validation_error', `reason must be 1–${MAX_TEXT} characters`, 422) };
  return { reason };
}

export interface BookingDeps {
  artists: MockArtists;
  userById: (id: string) => User | undefined;
  now: () => number;
  /** `review` and `can_review` (Increment 6); artists only see a public review. */
  reviewFields: (b: MockBooking, view: BookingView) => { review: BookingReview | null; can_review: boolean };
}

/** In-memory bookings for MockTransport: creation, the lazy 3h expiry, transitions and the scoped lists. */
export class MockBookings {
  private rows: MockBooking[] = [];
  private seq = 0;
  constructor(private deps: BookingDeps) {}

  private get now() { return this.deps.now(); }

  private code(): string {
    for (;;) {
      let c = 'BK-';
      for (let i = 0; i < 6; i++) c += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
      if (!this.rows.some((b) => b.code === c)) return c;
    }
  }

  /** Lazy expiry (no background job): requests past their deadline become `expired`, refund due. */
  private expire() {
    const now = this.now;
    for (const b of this.rows) {
      if (b.status === 'requested' && b.expiresAt < now) Object.assign(b, { status: 'expired', refundDue: true });
    }
  }

  /** Requested and confirmed bookings of an artist hold their time. */
  busy(artistId: string): Busy[] {
    this.expire();
    return this.rows.filter((b) => b.artistId === artistId && ACTIVE.includes(b.status)).map((b) => ({ start: b.start, end: b.end }));
  }

  completedCount(artistId: string): number {
    return this.rows.filter((b) => b.artistId === artistId && b.status === 'completed').length;
  }

  find(id: string): MockBooking | undefined {
    return this.rows.find((b) => b.id === id);
  }

  /** Test hook: a booking of `service` that finished at `completedAt`, as if accepted and marked completed. */
  completed(customerId: string, profile: MockProfile, service: ServiceItem, completedAt: number): MockBooking {
    const start = completedAt - service.duration_minutes * 60_000;
    const created = start - 2 * 24 * HOUR_MS;
    return this.insert({
      status: 'completed', customerId, artistId: profile.id, serviceId: service.id, serviceName: service.name,
      durationMinutes: service.duration_minutes, start, end: completedAt, address: '12 MG Road, Bangalore', note: null,
      money: priceBreakdown(service.price_paise), depositPaidAt: created, expiresAt: created + ACCEPT_WINDOW_HOURS * HOUR_MS,
      respondedAt: created + HOUR_MS, cancelledAt: null, completedAt, cancelledBy: null, declineReason: null, cancelReason: null,
      refundDue: null, createdAt: created,
    });
  }

  /** Seeds and test hooks: stores a row as-is, skipping the slot rules. */
  insert(row: Omit<MockBooking, 'id' | 'code'>): MockBooking {
    const b = { ...row, id: `mock-booking-${++this.seq}`, code: this.code() };
    this.rows.push(b);
    return b;
  }

  out(b: MockBooking, view: BookingView): Booking {
    const artist = this.deps.artists.byId(b.artistId)?.profile;
    const customer = this.deps.userById(b.customerId);
    return {
      id: b.id, code: b.code, status: b.status, start_at: new Date(b.start).toISOString(), end_at: new Date(b.end).toISOString(),
      address: b.address, note: b.note, service_name: b.serviceName, duration_minutes: b.durationMinutes,
      artist: {
        id: b.artistId, business_name: artist?.business_name ?? '', city: artist?.city ?? '',
        photo_url: artist ? this.deps.artists.photoUrl(artist) : null,
      },
      customer: { id: b.customerId, first_name: customer?.first_name ?? null, last_name: customer?.last_name ?? null },
      ...b.money,
      ...(view === 'customer' ? { commission_paise: null, artist_earning_paise: null } : {}),
      deposit_paid_at: iso(b.depositPaidAt), expires_at: new Date(b.expiresAt).toISOString(),
      responded_at: iso(b.respondedAt), cancelled_at: iso(b.cancelledAt), completed_at: iso(b.completedAt),
      decline_reason: b.declineReason, cancel_reason: b.cancelReason, cancelled_by: b.cancelledBy, refund_due: b.refundDue,
      created_at: new Date(b.createdAt).toISOString(),
      ...this.deps.reviewFields(b, view),
    };
  }

  private page(rows: MockBooking[], query: Query, view: BookingView): TransportResponse {
    const limit = Math.min(Math.max(Number(query.limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);
    const offset = Number(query.cursor) || 0;
    const slice = rows.slice(offset, offset + limit);
    const next = offset + limit < rows.length ? String(offset + limit) : null;
    return { status: 200, json: { items: slice.map((b) => this.out(b, view)), next_cursor: next } };
  }

  // ---- Customer (spec §1.4) ----

  /** POST /bookings. `view` is 'artist' only for the requestBooking test hook, which hands the artist's view to tests. */
  create(customer: User, b: Body, view: BookingView = 'customer'): TransportResponse {
    this.expire();
    const found = typeof b.artist_id === 'string' ? this.deps.artists.byId(b.artist_id) : undefined;
    if (!found || found.profile.status !== 'approved') return err('not_found', 'Artist not found', 404);
    const { userId: ownerId, profile } = found;
    if (ownerId === customer.id) return err('validation_error', "You can't book your own profile", 422);
    const service = profile.services.find((s) => s.id === b.service_id && s.status === 'approved');
    if (!service) return err('validation_error', 'Unknown service', 422);
    const address = text(b.address);
    if (!address || address.length > MAX_ADDRESS) return err('validation_error', `address must be 1–${MAX_ADDRESS} characters`, 422);
    const note = optional(b.note);
    if (note && note.length > MAX_TEXT) return err('validation_error', `note must be at most ${MAX_TEXT} characters`, 422);
    const open = this.rows.filter((r) => r.customerId === customer.id && r.status === 'requested').length;
    if (open >= MAX_OPEN_REQUESTS) return err('conflict', TOO_MANY, 409);
    const start = typeof b.start_at === 'string' ? Date.parse(b.start_at) : NaN;
    if (!this.isOpenSlot(profile, start, service.duration_minutes)) return err('conflict', TAKEN, 409);
    const now = this.now;
    const row = this.insert({
      status: 'requested', customerId: customer.id, artistId: profile.id, serviceId: service.id,
      serviceName: service.name, durationMinutes: service.duration_minutes,
      start, end: start + service.duration_minutes * 60_000, address, note, money: priceBreakdown(service.price_paise),
      depositPaidAt: now, expiresAt: Math.min(now + ACCEPT_WINDOW_HOURS * HOUR_MS, start),
      respondedAt: null, cancelledAt: null, completedAt: null, cancelledBy: null, declineReason: null, cancelReason: null,
      refundDue: null, createdAt: now,
    });
    return { status: 201, json: this.out(row, view) };
  }

  /** One of the day's slot starts, on a bookable date, and still free. */
  private isOpenSlot(profile: MockProfile, start: number, durationMinutes: number): boolean {
    if (Number.isNaN(start)) return false;
    const day = istDateKey(start);
    if (!isBookableDate(day, this.now)) return false;
    if (!slotStarts(day).some((s) => Date.parse(s) === start)) return false;
    return isSlotFree(start, durationMinutes, this.busy(profile.id), this.now);
  }

  customer(user: User, method: string, path: string, query: Query, body: Body): TransportResponse {
    if (method === 'POST' && path === '/bookings') return this.create(user, body);
    this.expire();
    if (method === 'GET' && path === '/bookings') return this.customerList(user.id, query.scope);
    const [, , id, action] = path.split('/');
    const b = this.rows.find((r) => r.id === id && r.customerId === user.id);
    if (!b) return err('not_found', 'Booking not found', 404);
    if (method === 'GET' && !action) return { status: 200, json: this.out(b, 'customer') };
    if (method === 'POST' && action === 'cancel') return this.cancel(b, body);
    return err('not_found', `Mock has no handler for ${method} ${path}`, 404);
  }

  private customerList(customerId: string, scope: string | undefined): TransportResponse {
    if (scope !== 'upcoming' && scope !== 'past') return err('validation_error', 'scope must be upcoming or past', 422);
    const now = this.now;
    const mine = this.rows.filter((b) => b.customerId === customerId);
    const isUpcoming = (b: MockBooking) => ACTIVE.includes(b.status) && b.end > now;
    const rows = scope === 'upcoming'
      ? mine.filter(isUpcoming).sort((a, b) => a.start - b.start)
      : mine.filter((b) => !isUpcoming(b)).sort((a, b) => b.start - a.start);
    return this.page(rows, {}, 'customer');
  }

  private cancel(b: MockBooking, body: Body): TransportResponse {
    if (!ACTIVE.includes(b.status)) return already(b);
    const now = this.now;
    const parsed = reasonOf(body.reason);
    if ('error' in parsed) return parsed.error;
    if (now >= b.start) return err('conflict', 'This booking has already started', 409);
    Object.assign(b, {
      status: 'cancelled', cancelledAt: now, cancelledBy: 'customer', cancelReason: parsed.reason,
      refundDue: refundDueOnCustomerCancel(b.start, now),
    });
    return { status: 200, json: this.out(b, 'customer') };
  }

  // ---- Artist (spec §1.5) ----

  artist(userId: string, method: string, path: string, query: Query, body: Body): TransportResponse {
    const profile = this.deps.artists.profileOf(userId);
    if (!profile) return err('not_found', 'No artist profile yet', 404);
    if (profile.status !== 'approved') return err('conflict', `Profile is ${profile.status}, not approved`, 409);
    this.expire();
    if (method === 'GET' && path === '/artists/me/dashboard') return this.dashboard(profile.id);
    if (method === 'GET' && path === '/artists/me/bookings') return this.artistList(profile.id, query);
    const [, , , , id, action] = path.split('/');
    const b = this.rows.find((r) => r.id === id && r.artistId === profile.id);
    if (!b) return err('not_found', 'Booking not found', 404);
    if (method !== 'POST') return err('not_found', `Mock has no handler for ${method} ${path}`, 404);
    const now = this.now;
    if (action === 'accept') {
      if (b.status !== 'requested') return already(b);
      Object.assign(b, { status: 'confirmed', respondedAt: now });
    } else if (action === 'decline') {
      if (b.status !== 'requested') return already(b);
      const parsed = reasonOf(body.reason);
      if ('error' in parsed) return parsed.error;
      Object.assign(b, { status: 'declined', respondedAt: now, declineReason: parsed.reason, refundDue: true });
    } else if (action === 'complete') {
      if (b.status !== 'confirmed') return already(b);
      if (now < b.start) return err('conflict', 'You can mark it completed once it has started', 409);
      Object.assign(b, { status: 'completed', completedAt: now });
    } else {
      return err('not_found', `Mock has no handler for ${method} ${path}`, 404);
    }
    return { status: 200, json: this.out(b, 'artist') };
  }

  private artistList(artistId: string, query: Query): TransportResponse {
    const { scope, from, to } = query;
    if (scope && !['requests', 'upcoming', 'past'].includes(scope)) return err('validation_error', 'scope must be requests, upcoming or past', 422);
    const lo = from ? istDayStart(from) : -Infinity;
    const hi = to ? istDayStart(addDays(to, 1)) : Infinity;
    if (Number.isNaN(lo) || Number.isNaN(hi)) return err('validation_error', 'from and to must be YYYY-MM-DD', 422);
    let rows = this.rows.filter((b) => b.artistId === artistId && b.start >= lo && b.start < hi);
    if (scope === 'requests') rows = rows.filter((b) => b.status === 'requested').sort((a, b) => a.expiresAt - b.expiresAt);
    else if (scope === 'upcoming') rows = rows.filter((b) => b.status === 'confirmed').sort((a, b) => a.start - b.start);
    else if (scope === 'past') rows = rows.filter((b) => !ACTIVE.includes(b.status)).sort((a, b) => b.start - a.start);
    else rows = [...rows].sort((a, b) => a.start - b.start);
    return this.page(rows, query, 'artist');
  }

  private dashboard(artistId: string): TransportResponse {
    const now = this.now;
    const mine = this.rows.filter((b) => b.artistId === artistId);
    const month = istDateKey(now).slice(0, 7);
    const completed = mine.filter((b) => b.status === 'completed' && b.completedAt !== null && istDateKey(b.completedAt).startsWith(month));
    const today = istDateKey(now);
    return {
      status: 200,
      json: {
        requests: mine.filter((b) => b.status === 'requested').length,
        upcoming: mine.filter((b) => b.status === 'confirmed').length,
        completed_this_month: completed.length,
        earnings_this_month_paise: completed.reduce((sum, b) => sum + b.money.artist_earning_paise, 0),
        today: mine
          .filter((b) => (b.status === 'confirmed' || b.status === 'completed') && istDateKey(b.start) === today)
          .sort((a, b) => a.start - b.start)
          .map((b) => this.out(b, 'artist')),
      },
    };
  }
}
