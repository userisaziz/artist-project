import type { ArtistReview, Review } from '../api/types';
import type { PillTone } from '../components/StatusPill';
import { formatMonthShort } from '../bookings/time';

const MAX_STARS = 5;

/** One decimal, always: 5 → "5.0". */
export const formatAverage = (average: number) => average.toFixed(1);

/** "128 reviews", "1 review", "No reviews yet". */
export function reviewCountLabel(count: number): string {
  if (!count) return 'No reviews yet';
  return `${count} ${count === 1 ? 'review' : 'reviews'}`;
}

/** Artist cards: "★ 4.9 (128)", or "New" when there are no public reviews. */
export function ratingShort(rating: number | null, count: number): string {
  return rating === null || !count ? 'New' : `★ ${formatAverage(rating)} (${count})`;
}

/** Storefront stats: "★ 4.9 · 128 reviews", or "New". */
export function ratingLong(rating: number | null, count: number): string {
  return rating === null || !count ? 'New' : `★ ${formatAverage(rating)} · ${reviewCountLabel(count)}`;
}

/** "★★★★☆", rounded to the nearest whole star. */
export function starString(rating: number): string {
  const full = Math.min(MAX_STARS, Math.max(0, Math.round(rating)));
  return '★'.repeat(full) + '☆'.repeat(MAX_STARS - full);
}

/** "Bridal Classic · Sep 2026" */
export function reviewMeta(review: Pick<Review, 'service_name' | 'created_at'>): string {
  return `${review.service_name} · ${formatMonthShort(review.created_at)}`;
}

/** Spec §2.2: pills on reviews that aren't plainly public. */
export function reviewStatusPill(review: Pick<ArtistReview, 'status' | 'flag'>): { label: string; tone: PillTone } | null {
  if (review.status === 'hidden') return { label: 'Hidden: being checked', tone: 'pending' };
  if (review.status === 'flagged') return review.flag === 'artist_report' ? { label: 'Reported', tone: 'danger' } : { label: 'Flagged', tone: 'pending' };
  return null;
}
