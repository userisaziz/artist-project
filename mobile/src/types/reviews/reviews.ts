import type { Page } from '../../core/api/types';

export type ReviewStatus = 'published' | 'flagged' | 'hidden' | 'removed';

export type ReviewFlag = 'contact_info' | 'blocked_word' | 'artist_report';

export type StarRating = 1 | 2 | 3 | 4 | 5;

/** ReviewOut: what anyone sees on the storefront. */
export interface Review {
  id: string;
  rating: number;
  text: string | null;
  reviewer_name: string; // "Priya S.", or "Atelier customer"
  service_name: string;
  created_at: string;
  reply: string | null;
  replied_at: string | null;
}

/** OwnReviewOut: the reviewer's and the artist's view, with where it stands in moderation ('hidden' = being checked). */
export interface ArtistReview extends Review {
  status: ReviewStatus;
  flag: ReviewFlag | null;
  report_reason: string | null;
}

/** POST /bookings/{id}/review answers with the reviewer's own view. */
export type PostedReview = ArtistReview;

export interface ReviewInput {
  rating: StarRating;
  text?: string | null;
}

export interface ReviewSummary {
  average: number | null;
  count: number;
  distribution: Record<'5' | '4' | '3' | '2' | '1', number>;
}

export interface ReviewPage<T extends Review> extends Page<T> {
  summary: ReviewSummary;
}

/** The review on a customer's booking. */
export interface BookingReview {
  id: string;
  rating: number;
  status: ReviewStatus;
}
