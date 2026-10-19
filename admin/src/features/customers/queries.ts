import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { CustomerDetail, CustomerPage, CustomerSegment, CustomerSummary } from './types'

const PAGE_SIZE = 20

export const customerKeys = {
  all: ['admin', 'customers'] as const,
  list: (segment: CustomerSegment, q: string) => ['admin', 'customers', 'list', segment, q] as const,
  summary: ['admin', 'customers', 'summary'] as const,
  detail: (id: string) => ['admin', 'customers', 'detail', id] as const,
}

function filters(segment: CustomerSegment, q: string) {
  const params = new URLSearchParams({ segment })
  if (q) params.set('q', q)
  return params
}

/** Newest accounts first, a page at a time; the previous rows stay up while another filter loads. */
export function useCustomers(segment: CustomerSegment, q: string) {
  return useInfiniteQuery({
    queryKey: customerKeys.list(segment, q),
    queryFn: ({ pageParam }) => {
      const params = filters(segment, q)
      params.set('limit', String(PAGE_SIZE))
      if (pageParam) params.set('cursor', pageParam)
      return api<CustomerPage>(`/admin/customers?${params.toString()}`)
    },
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor,
    placeholderData: keepPreviousData,
  })
}

export function useCustomerSummary() {
  return useQuery({ queryKey: customerKeys.summary, queryFn: () => api<CustomerSummary>('/admin/customers/summary') })
}

export function useCustomer(id: string) {
  return useQuery({ queryKey: customerKeys.detail(id), queryFn: () => api<CustomerDetail>(`/admin/customers/${id}`), enabled: !!id })
}

/** The filtered directory as CSV text (the page saves it as a file). */
export function exportCustomers(segment: CustomerSegment, q: string) {
  return api<string>(`/admin/customers/export?${filters(segment, q).toString()}`, { parse: 'text' })
}

/** Block (with a reason) or unblock; the returned detail is cached and every list and count refreshes. */
export function useSetBlocked(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (reason: string | null) =>
      reason === null
        ? api<CustomerDetail>(`/admin/customers/${id}/unblock`, { method: 'POST' })
        : api<CustomerDetail>(`/admin/customers/${id}/block`, { method: 'POST', body: { reason } }),
    onSuccess: (detail) => queryClient.setQueryData(customerKeys.detail(id), detail),
    onSettled: () => queryClient.invalidateQueries({ queryKey: customerKeys.all }),
  })
}
