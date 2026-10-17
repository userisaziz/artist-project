import { useCallback } from 'react';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import * as reviewsApi from '../api/endpoints/reviews';
import type { ArtistReview, Booking, PostedReview, ReviewInput } from '../core/api/types';
import { useAuth } from '../auth/auth-provider';
import { bookingKeys } from '../bookings/queries';
import { directoryKeys } from '../directory/queries';

const PAGE_SIZE = 20;
export const PREVIEW_COUNT = 3; // the storefront shows the first three

export const reviewKeys = {
  all: ['reviews'] as const,
  preview: (artistId: string) => ['reviews', 'public', artistId, 'preview'] as const,
  public: (artistId: string) => ['reviews', 'public', artistId, 'all'] as const,
  // Keyed by user id, so another account on the device never sees cached reviews.
  mine: (userId: string | undefined) => ['reviews', 'mine', userId] as const,
};

/** The storefront's Reviews block: the summary and the newest three. */
export function useReviewPreview(artistId: string) {
  return useQuery({
    queryKey: reviewKeys.preview(artistId),
    queryFn: () => reviewsApi.listArtistReviews(artistId, null, PREVIEW_COUNT),
    enabled: !!artistId,
  });
}

/** "See all reviews": every public review, page by page. */
export function usePublicReviews(artistId: string) {
  return useInfiniteQuery({
    queryKey: reviewKeys.public(artistId),
    queryFn: ({ pageParam }) => reviewsApi.listArtistReviews(artistId, pageParam, PAGE_SIZE),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor,
    enabled: !!artistId,
  });
}

/** The approved artist's own reviews, with their status. */
export function useMyReviews() {
  const { user } = useAuth();
  return useInfiniteQuery({
    queryKey: reviewKeys.mine(user?.id),
    queryFn: ({ pageParam }) => reviewsApi.listMyReviews(pageParam, PAGE_SIZE),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor,
    enabled: !!user,
  });
}

/**
 * Posts a customer's review. The booking's card switches at once (review set, can_review off); then every booking
 * list, every review list and the directory (card and storefront ratings) refresh.
 */
export function usePostReview() {
  const { user } = useAuth();
  const client = useQueryClient();
  return useCallback(async (bookingId: string, input: ReviewInput): Promise<PostedReview> => {
    const posted = await reviewsApi.postReview(bookingId, input);
    client.setQueryData<Booking>(bookingKeys.detail(user?.id, bookingId), (old) => old && {
      ...old, review: { id: posted.id, rating: posted.rating, status: posted.status }, can_review: false,
    });
    await Promise.all([
      client.invalidateQueries({ queryKey: bookingKeys.all, predicate: (q) => q.queryKey[1] !== 'detail' || q.queryKey[3] !== bookingId }),
      client.invalidateQueries({ queryKey: reviewKeys.all }),
      client.invalidateQueries({ queryKey: directoryKeys.all }),
    ]);
    return posted;
  }, [client, user?.id]);
}

/** Runs an artist reply or report, then refreshes the artist's list and the public lists (replies are public). */
export function useMyReviewWrite() {
  const client = useQueryClient();
  return useCallback(async (write: () => Promise<ArtistReview>) => {
    const review = await write();
    await client.invalidateQueries({ queryKey: reviewKeys.all });
    return review;
  }, [client]);
}
