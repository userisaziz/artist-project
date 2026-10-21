import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { NotificationPage } from './types'

const UNREAD_POLL_MS = 30_000

export const notificationKeys = {
  all: ['admin', 'notifications'] as const,
  list: ['admin', 'notifications', 'list'] as const,
  unread: ['admin', 'notifications', 'unread'] as const,
}

/** Newest first, a page at a time. */
export function useNotifications() {
  return useInfiniteQuery({
    queryKey: notificationKeys.list,
    queryFn: ({ pageParam }) => api<NotificationPage>(pageParam ? `/notifications?cursor=${encodeURIComponent(pageParam)}` : '/notifications'),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor,
  })
}

/** The sidebar badge; re-read while the console is open. */
export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: notificationKeys.unread,
    queryFn: () => api<{ count: number }>('/notifications/unread-count'),
    select: (d) => d.count,
    refetchInterval: UNREAD_POLL_MS,
  })
}

/** `null` marks everything read. */
export function useMarkNotificationsRead() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (ids: string[] | null) => api<void>('/notifications/read', { method: 'POST', body: { ids } }),
    onSuccess: () => client.invalidateQueries({ queryKey: notificationKeys.all }),
  })
}
