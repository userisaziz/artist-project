import { request } from '../../core/api/client';
import { withQuery } from '../../core/api/query-string';
import type { ArtistReview, PostedReview, Review, ReviewInput, ReviewPage } from '../../types/reviews/reviews';

// Reviews (spec Increment 6 §1.2).

/** Customer: rate a completed booking, once, within 30 days. `status` 'hidden' means it is being checked. */
export function postReview(bookingId: string, body: ReviewInput) {
  return request<PostedReview>(`/bookings/${encodeURIComponent(bookingId)}/review`, body, { auth: true });
}

/** Public reviews of an artist, newest first, with the summary. No auth. */
export function listArtistReviews(artistId: string, cursor?: string | null, limit?: number) {
  return request<ReviewPage<Review>>(withQuery(`/artists/${encodeURIComponent(artistId)}/reviews`, { cursor, limit }), undefined, { method: 'GET' });
}

/** Approved artist: every review except removed ones, with its status. */
export function listMyReviews(cursor?: string | null, limit?: number) {
  return request<ReviewPage<ArtistReview>>(withQuery('/artists/me/reviews', { cursor, limit }), undefined, { auth: true, method: 'GET' });
}

/** 1–500 characters; an empty string clears the reply. */
export function replyToReview(id: string, text: string) {
  return request<ArtistReview>(`/artists/me/reviews/${encodeURIComponent(id)}/reply`, { text }, { auth: true, method: 'PUT' });
}

/** Published reviews only; the review becomes flagged and stays public until a moderator decides. */
export function reportReview(id: string, reason: string) {
  return request<ArtistReview>(`/artists/me/reviews/${encodeURIComponent(id)}/report`, { reason }, { auth: true });
}
