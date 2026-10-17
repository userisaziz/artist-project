import type { ArtistReview, BookingReview, PostedReview, Review, ReviewFlag, ReviewStatus, ReviewSummary, User } from '../types';
import type { TransportResponse } from '../transport';
import type { MockBooking } from './bookings';
import { reviewFlag } from '../../reviews/filter';

// Reviews (spec Increment 6 §1.2–§1.3), same rules as backend services/review_service.py — keep them in lockstep.

const DAY_MS = 24 * 3600_000;
export const REVIEW_WINDOW_DAYS = 30;
const PUBLIC_LIMITS = { fallback: 10, max: 50 }; // backend directory.py: Query(10, ge=1, le=50)
const ARTIST_LIMITS = { fallback: 20, max: 100 }; // backend artist_reviews.py: Query(20, ge=1, le=100)
const MAX_TEXT = 1000;
const MAX_REPLY = 500;
const MAX_REASON = 500;
const PUBLIC: ReviewStatus[] = ['published', 'flagged'];
export const REPLY_REFUSED = "Replies can't include phone numbers, emails, links or blocked words";
const STARS = ['5', '4', '3', '2', '1'] as const;

export interface MockReview {
  id: string; seq: number;
  bookingId: string; artistId: string; customerId: string; serviceName: string;
  rating: number; text: string | null;
  status: ReviewStatus; flag: ReviewFlag | null; reportReason: string | null;
  reply: string | null; repliedAt: number | null; createdAt: number;
}

export interface ReviewDeps {
  userById: (id: string) => User | undefined;
  booking: (id: string) => MockBooking | undefined;
  now: () => number;
}

/** What a seeded review may preset; the status otherwise comes from the auto-filter. */
export interface SeedReview {
  rating: number;
  text: string | null;
  status?: ReviewStatus;
  flag?: ReviewFlag;
  reportReason?: string;
  reply?: string;
}

type Body = Record<string, unknown>;
type Query = Record<string, string>;

const err = (code: string, message: string, status: number): TransportResponse => ({ status, json: { code, message } });
const ok = (json: unknown, status = 200): TransportResponse => ({ status, json });
const iso = (ms: number | null) => (ms === null ? null : new Date(ms).toISOString());
const isStar = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 5;
const newestFirst = (a: MockReview, b: MockReview) => b.createdAt - a.createdAt || b.seq - a.seq;

/** "Priya S."; "Atelier customer" without a name. */
export function reviewerName(user: Pick<User, 'first_name' | 'last_name'> | undefined): string {
  const first = user?.first_name?.trim();
  if (!first) return 'Atelier customer';
  const initial = user?.last_name?.trim().charAt(0);
  return initial ? `${first} ${initial.toUpperCase()}.` : first;
}

/** Summary of the public reviews: average to one decimal (null when none), count and the 5→1 distribution. */
export function summarize(ratings: number[]): ReviewSummary {
  const distribution = Object.fromEntries(STARS.map((s) => [s, ratings.filter((r) => String(r) === s).length])) as ReviewSummary['distribution'];
  // Half up to one decimal (4.25 → 4.3): the integer sum keeps exact halves exact.
  const average = ratings.length ? Math.round((ratings.reduce((sum, r) => sum + r, 0) * 10) / ratings.length) / 10 : null;
  return { average, count: ratings.length, distribution };
}

/** A pagination slice the way every mock list does it: the cursor is the offset. */
function slice<T>(rows: T[], query: Query, limits: { fallback: number; max: number }): { items: T[]; next_cursor: string | null } {
  const limit = Math.min(Math.max(Number(query.limit) || limits.fallback, 1), limits.max);
  const offset = Number(query.cursor) || 0;
  return { items: rows.slice(offset, offset + limit), next_cursor: offset + limit < rows.length ? String(offset + limit) : null };
}

/** An optional review text: absent, null or blank is null; a non-string or over-long one is a validation error. */
function textOf(v: unknown): { text: string | null } | { error: TransportResponse } {
  if (v === undefined || v === null) return { text: null };
  if (typeof v !== 'string' || v.length > MAX_TEXT) return { error: err('validation_error', `text must be at most ${MAX_TEXT} characters`, 422) };
  return { text: v.trim() || null };
}

/** In-memory reviews for MockTransport: posting, the public list and summary, and the artist's reply and report. */
export class MockReviews {
  private rows: MockReview[] = [];
  private seq = 0;
  constructor(private deps: ReviewDeps) {}

  private get now() { return this.deps.now(); }

  private publicOut(r: MockReview): Review {
    return {
      id: r.id, rating: r.rating, text: r.text, reviewer_name: reviewerName(this.deps.userById(r.customerId)),
      service_name: r.serviceName, created_at: new Date(r.createdAt).toISOString(), reply: r.reply, replied_at: iso(r.repliedAt),
    };
  }

  private artistOut(r: MockReview): ArtistReview {
    return { ...this.publicOut(r), status: r.status, flag: r.flag, report_reason: r.reportReason };
  }

  private publicRows(artistId: string): MockReview[] {
    return this.rows.filter((r) => r.artistId === artistId && PUBLIC.includes(r.status)).sort(newestFirst);
  }

  private summary(artistId: string): ReviewSummary {
    return summarize(this.publicRows(artistId).map((r) => r.rating));
  }

  private insert(b: MockBooking, rating: number, text: string | null, createdAt: number): MockReview {
    const flag = text ? reviewFlag(text) : null;
    const seq = ++this.seq;
    const row: MockReview = {
      id: `mock-review-${seq}`, seq, bookingId: b.id, artistId: b.artistId, customerId: b.customerId, serviceName: b.serviceName,
      rating, text, status: flag ? 'hidden' : 'published', flag, reportReason: null, reply: null, repliedAt: null, createdAt,
    };
    this.rows.push(row);
    return row;
  }

  private withinWindow(b: MockBooking): boolean {
    return b.completedAt !== null && this.now <= b.completedAt + REVIEW_WINDOW_DAYS * DAY_MS;
  }

  // ---- Read side for the directory and bookings ----

  /** `rating` and `review_count` for ArtistCard and ArtistPublic: computed on read, public reviews only. */
  stats(artistId: string): { rating: number | null; review_count: number } {
    const { average, count } = this.summary(artistId);
    return { rating: average, review_count: count };
  }

  /**
   * `review` and `can_review` on BookingOut. Customers see their own review in any state; artists only see a public
   * (published or flagged) one. `can_review` is the same for both.
   */
  bookingFields(b: MockBooking, view: 'customer' | 'artist'): { review: BookingReview | null; can_review: boolean } {
    const r = this.rows.find((row) => row.bookingId === b.id);
    const visible = r && (view === 'customer' || PUBLIC.includes(r.status));
    return {
      review: visible ? { id: r.id, rating: r.rating, status: r.status } : null,
      can_review: !r && b.status === 'completed' && this.withinWindow(b),
    };
  }

  // ---- Customer: POST /bookings/{id}/review ----

  post(customer: User, bookingId: string, body: Body): TransportResponse {
    if (!isStar(body.rating)) return err('validation_error', 'rating must be a whole number from 1 to 5', 422);
    const parsed = textOf(body.text);
    if ('error' in parsed) return parsed.error;
    const b = this.deps.booking(bookingId);
    if (!b || b.customerId !== customer.id) return err('not_found', 'Booking not found', 404);
    if (b.status !== 'completed') return err('conflict', "You can review a booking once it's completed", 409);
    if (!this.withinWindow(b)) return err('conflict', `Reviews open for ${REVIEW_WINDOW_DAYS} days after the booking`, 409);
    if (this.rows.some((r) => r.bookingId === b.id)) return err('conflict', "You've already reviewed this booking", 409);
    const row = this.insert(b, body.rating, parsed.text, this.now);
    const out: PostedReview = this.artistOut(row);
    return ok(out, 201);
  }

  // ---- Public: GET /artists/{id}/reviews ----

  publicPage(artistId: string, query: Query): TransportResponse {
    const page = slice(this.publicRows(artistId), query, PUBLIC_LIMITS);
    return ok({ items: page.items.map((r) => this.publicOut(r)), next_cursor: page.next_cursor, summary: this.summary(artistId) });
  }

  // ---- Approved artist: /artists/me/reviews… ----

  artist(artistId: string, method: string, path: string, query: Query, body: Body): TransportResponse {
    if (method === 'GET' && path === '/artists/me/reviews') {
      const rows = this.rows.filter((r) => r.artistId === artistId && r.status !== 'removed').sort(newestFirst);
      const page = slice(rows, query, ARTIST_LIMITS);
      return ok({ items: page.items.map((r) => this.artistOut(r)), next_cursor: page.next_cursor, summary: this.summary(artistId) });
    }
    const [, , , , id, action] = path.split('/');
    const r = this.rows.find((row) => row.id === id && row.artistId === artistId && row.status !== 'removed');
    if (!r) return err('not_found', 'Review not found', 404);
    if (method === 'PUT' && action === 'reply') return this.reply(r, body.text);
    if (method === 'POST' && action === 'report') return this.report(r, body.reason);
    return err('not_found', `Mock has no handler for ${method} ${path}`, 404);
  }

  /** 1–500 characters; an empty string clears the reply. Contact details and blocked words are refused (422). */
  private reply(r: MockReview, v: unknown): TransportResponse {
    if (typeof v !== 'string' || v.length > MAX_REPLY) return err('validation_error', `text must be at most ${MAX_REPLY} characters`, 422);
    const text = v.trim();
    if (text && reviewFlag(text)) return err('validation_error', REPLY_REFUSED, 422);
    Object.assign(r, text ? { reply: text, repliedAt: this.now } : { reply: null, repliedAt: null });
    return ok(this.artistOut(r));
  }

  /** Once, from published only: the review becomes `flagged` and stays public until a moderator decides. */
  private report(r: MockReview, v: unknown): TransportResponse {
    const reason = typeof v === 'string' ? v.trim() : '';
    if (!reason || reason.length > MAX_REASON) return err('validation_error', `reason must be 1–${MAX_REASON} characters`, 422);
    if (r.status !== 'published') return err('conflict', 'Only published reviews can be reported', 409);
    Object.assign(r, { status: 'flagged', flag: 'artist_report', reportReason: reason });
    return ok(this.artistOut(r));
  }

  // ---- Seeds ----

  /** Seeded review on a completed booking, a day after it finished. */
  seed(b: MockBooking, s: SeedReview): MockReview {
    const at = (b.completedAt ?? this.now) + DAY_MS;
    const row = this.insert(b, s.rating, s.text, Math.min(at, this.now));
    if (s.status) Object.assign(row, { status: s.status, flag: s.flag ?? null, reportReason: s.reportReason ?? null });
    if (s.reply) Object.assign(row, { reply: s.reply, repliedAt: row.createdAt + DAY_MS / 2 });
    return row;
  }
}
