import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { RequestStatus, SubcategoryRequest, SubcategoryRequestPage, SubcategoryRequestSummary } from './types'

const PAGE_SIZE = 20

export const subcategoryRequestKeys = {
  all: ['admin', 'subcategory-requests'] as const,
  list: (status: RequestStatus) => ['admin', 'subcategory-requests', 'list', status] as const,
  summary: ['admin', 'subcategory-requests', 'summary'] as const,
}

/** Oldest first, a page at a time. */
export function useSubcategoryRequests(status: RequestStatus) {
  return useInfiniteQuery({
    queryKey: subcategoryRequestKeys.list(status),
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ status, limit: String(PAGE_SIZE) })
      if (pageParam) params.set('cursor', pageParam)
      return api<SubcategoryRequestPage>(`/admin/subcategory-requests?${params.toString()}`)
    },
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor,
    placeholderData: keepPreviousData,
  })
}

/** Chip counts, the KPI strip and the sidebar count. */
export function useSubcategoryRequestSummary() {
  return useQuery({
    queryKey: subcategoryRequestKeys.summary,
    queryFn: () => api<SubcategoryRequestSummary>('/admin/subcategory-requests/summary'),
    refetchInterval: 60_000,
  })
}

/**
 * Approve (optionally renamed) into the catalog, or reject with a reason. Approving adds a category, so the
 * Catalog's cache is refreshed too (its key is ['admin', 'categories']).
 */
export function useDecideSubcategoryRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: { action: 'approve'; name: string } | { action: 'reject'; reason: string } }) =>
      decision.action === 'approve'
        ? api<SubcategoryRequest>(`/admin/subcategory-requests/${id}/approve`, { method: 'POST', body: { name: decision.name } })
        : api<SubcategoryRequest>(`/admin/subcategory-requests/${id}/reject`, { method: 'POST', body: { reason: decision.reason } }),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: subcategoryRequestKeys.all }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'categories'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'custom-services'] }),
      ]),
  })
}
