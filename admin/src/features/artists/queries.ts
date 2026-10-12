import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { ArtistDetail, ArtistSummary, Page, ReviewStatus } from '@/lib/types'

export const artistKeys = {
  all: ['admin', 'artists'] as const,
  list: (status: ReviewStatus) => ['admin', 'artists', 'list', status] as const,
  detail: (id: string) => ['admin', 'artists', 'detail', id] as const,
  pendingCount: ['admin', 'artists', 'pending-count'] as const,
}

export function useArtistQueue(status: ReviewStatus) {
  return useInfiniteQuery({
    queryKey: artistKeys.list(status),
    queryFn: ({ pageParam }) =>
      api<Page<ArtistSummary>>(`/admin/artists?status=${status}&limit=20${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ''}`),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor,
  })
}

/** Sidebar badge: pending submissions, shown as "99+" past one page of 100. */
export function usePendingCount() {
  return useQuery({
    queryKey: artistKeys.pendingCount,
    queryFn: async () => {
      const page = await api<Page<ArtistSummary>>('/admin/artists?status=pending&limit=100')
      return page.next_cursor ? '99+' : page.items.length || null
    },
    refetchInterval: 60_000,
  })
}

export function useArtist(id: string) {
  return useQuery({ queryKey: artistKeys.detail(id), queryFn: () => api<ArtistDetail>(`/admin/artists/${id}`) })
}

export function useReviewArtist(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (decision: { action: 'approve' } | { action: 'reject'; reason: string }) =>
      decision.action === 'approve'
        ? api<ArtistDetail>(`/admin/artists/${id}/approve`, { method: 'POST' })
        : api<ArtistDetail>(`/admin/artists/${id}/reject`, { method: 'POST', body: { reason: decision.reason } }),
    onSuccess: (artist) => {
      queryClient.setQueryData(artistKeys.detail(id), artist)
      return queryClient.invalidateQueries({ queryKey: artistKeys.all })
    },
  })
}

/** Logged by the server. Not a query or a mutation on purpose: the full number lives only in the caller's component state. */
export function revealAadhaar(id: string) {
  return api<{ aadhaar_number: string }>(`/admin/artists/${id}/kyc/reveal`, { method: 'POST' })
}
