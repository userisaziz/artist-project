import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { artistKeys } from '@/features/artists/queries'
import { api } from '@/lib/api'
import type { CustomServiceItem, CustomServicePage, ReviewStatus } from '@/lib/types'

export const customServiceKeys = {
  all: ['admin', 'custom-services'] as const,
  list: (status: ReviewStatus) => ['admin', 'custom-services', 'list', status] as const,
  pendingCount: ['admin', 'custom-services', 'pending-count'] as const,
}

export function useCustomServiceQueue(status: ReviewStatus) {
  return useInfiniteQuery({
    queryKey: customServiceKeys.list(status),
    queryFn: ({ pageParam }) =>
      api<CustomServicePage>(`/admin/custom-services?status=${status}&limit=20${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ''}`),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor,
  })
}

/** Sidebar badge, like the Verification one: "99+" past one page of 100. */
export function useCustomServicePendingCount() {
  return useQuery({
    queryKey: customServiceKeys.pendingCount,
    queryFn: async () => {
      const page = await api<CustomServicePage>('/admin/custom-services?status=pending&limit=100')
      return page.next_cursor ? '99+' : page.items.length || null
    },
    refetchInterval: 60_000,
  })
}

export function useDecideCustomService() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: { action: 'approve' } | { action: 'reject'; reason: string } }) =>
      decision.action === 'approve'
        ? api<CustomServiceItem>(`/admin/custom-services/${id}/approve`, { method: 'POST' })
        : api<CustomServiceItem>(`/admin/custom-services/${id}/reject`, { method: 'POST', body: { reason: decision.reason } }),
    // The artist's detail page lists the service too, with its status.
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: customServiceKeys.all }),
      queryClient.invalidateQueries({ queryKey: artistKeys.all }),
    ]),
  })
}
