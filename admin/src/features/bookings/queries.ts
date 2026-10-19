import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { overviewKeys } from '@/features/overview/queries'
import { api } from '@/lib/api'
import type { AdminBooking, AdminOverview, BookingPage, BookingStatus } from '@/lib/types'

const PAGE_SIZE = 20

/** `status` null = every status; `q` matches the code, the customer's phone or the artist's business name. */
export interface BookingFilter {
  status: BookingStatus | null
  q: string
}

export const bookingKeys = {
  all: ['admin', 'bookings'] as const,
  list: ({ status, q }: BookingFilter) => ['admin', 'bookings', 'list', status ?? 'all', q] as const,
  detail: (id: string) => ['admin', 'bookings', 'detail', id] as const,
}

function listPath({ status, q }: BookingFilter, cursor: string | null) {
  const params = new URLSearchParams({ limit: String(PAGE_SIZE) })
  if (status) params.set('status', status)
  if (q) params.set('q', q)
  if (cursor) params.set('cursor', cursor)
  return `/admin/bookings?${params.toString()}`
}

/** Newest first, a page at a time. The previous rows stay up while a new filter or search loads. */
export function useBookings(filter: BookingFilter) {
  return useInfiniteQuery({
    queryKey: bookingKeys.list(filter),
    queryFn: ({ pageParam }) => api<BookingPage>(listPath(filter, pageParam)),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor,
    placeholderData: keepPreviousData,
  })
}

/** The KPI strip over the list: the Overview's last-30-days, all-cities figures (same cache entry as the sidebar). */
export function useBookingKpis() {
  return useQuery({
    queryKey: ['admin', 'overview', '30d', 'all'] as const,
    queryFn: () => api<AdminOverview>('/admin/overview?period=30d'),
    refetchInterval: 60_000,
  })
}

export function useBooking(id: string) {
  return useQuery({ queryKey: bookingKeys.detail(id), queryFn: () => api<AdminBooking>(`/admin/bookings/${id}`) })
}

/** Admin cancel: allowed for requested and confirmed bookings at any time; the reason is required. */
export function useCancelBooking(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (reason: string) => api<AdminBooking>(`/admin/bookings/${id}/cancel`, { method: 'POST', body: { reason } }),
    onSuccess: (booking) => {
      queryClient.setQueryData(bookingKeys.detail(id), booking)
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: bookingKeys.all }),
        queryClient.invalidateQueries({ queryKey: overviewKeys.all }),
      ])
    },
  })
}
