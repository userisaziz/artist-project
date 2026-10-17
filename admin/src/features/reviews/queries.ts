import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { overviewKeys } from '@/features/overview/queries'
import { api } from '@/lib/api'
import type { AdminReview, ReviewDecision, ReviewModerationStatus, ReviewPage } from '@/lib/types'

const PAGE_SIZE = 20
const BADGE_PAGE_SIZE = 100
const BADGE_REFRESH_MS = 60_000

export const reviewKeys = {
  all: ['admin', 'reviews'] as const,
  list: (status: ReviewModerationStatus) => ['admin', 'reviews', 'list', status] as const,
  pendingCount: ['admin', 'reviews', 'pending-count'] as const,
}

function listPath(status: ReviewModerationStatus, limit: number, cursor: string | null = null) {
  const params = new URLSearchParams({ status, limit: String(limit) })
  if (cursor) params.set('cursor', cursor)
  return `/admin/reviews?${params.toString()}`
}

/** Newest first, a page at a time. The previous rows stay up while another status loads. */
export function useReviews(status: ReviewModerationStatus) {
  return useInfiniteQuery({
    queryKey: reviewKeys.list(status),
    queryFn: ({ pageParam }) => api<ReviewPage>(listPath(status, PAGE_SIZE, pageParam)),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor,
    placeholderData: keepPreviousData,
  })
}

/**
 * Sidebar badge: flagged reviews plus hidden ones no moderator has decided on yet
 * (the auto-filter's catches). Like the Custom services badge, "99+" past one page of 100.
 */
export function useReviewPendingCount() {
  return useQuery({
    queryKey: reviewKeys.pendingCount,
    queryFn: async () => {
      const [flagged, hidden] = await Promise.all([
        api<ReviewPage>(listPath('flagged', BADGE_PAGE_SIZE)),
        api<ReviewPage>(listPath('hidden', BADGE_PAGE_SIZE)),
      ])
      if (flagged.next_cursor || hidden.next_cursor) return '99+'
      return flagged.items.length + hidden.items.filter((r) => r.moderated_at === null).length || null
    },
    refetchInterval: BADGE_REFRESH_MS,
  })
}

/** Publish, hide or remove, with an optional internal note. A removed review answers 409. */
export function useDecideReview() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, decision, note }: { id: string; decision: ReviewDecision; note?: string }) =>
      api<AdminReview>(`/admin/reviews/${id}/decision`, { method: 'POST', body: note ? { decision, note } : { decision } }),
    onSettled: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: reviewKeys.all }),
      queryClient.invalidateQueries({ queryKey: overviewKeys.all }),
    ]),
  })
}
