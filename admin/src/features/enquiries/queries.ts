import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Enquiry, EnquiryFilter, EnquiryPage, EnquirySummary } from './types'

const PAGE_SIZE = 20

export const enquiryKeys = {
  all: ['admin', 'enquiries'] as const,
  list: (status: EnquiryFilter) => ['admin', 'enquiries', 'list', status] as const,
  summary: ['admin', 'enquiries', 'summary'] as const,
}

/** Messages the contact filter caught, newest first, a page at a time. */
export function useEnquiries(status: EnquiryFilter) {
  return useInfiniteQuery({
    queryKey: enquiryKeys.list(status),
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ status, limit: String(PAGE_SIZE) })
      if (pageParam) params.set('cursor', pageParam)
      return api<EnquiryPage>(`/admin/enquiries?${params.toString()}`)
    },
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor,
    placeholderData: keepPreviousData,
  })
}

/** Chip counts, the KPI strip and the sidebar count (held = waiting for a decision). */
export function useEnquirySummary() {
  return useQuery({ queryKey: enquiryKeys.summary, queryFn: () => api<EnquirySummary>('/admin/enquiries/summary'), refetchInterval: 60_000 })
}

/** Allow delivers a held message to the other side; hide means it is never delivered. Both are final. */
export function useDecideEnquiry() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'allow' | 'hide' }) =>
      api<Enquiry>(`/admin/enquiries/${id}/${decision}`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: enquiryKeys.all }),
  })
}
