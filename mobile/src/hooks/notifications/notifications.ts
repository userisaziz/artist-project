import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as notificationsApi from '../../api/notifications/notifications';
import { useAuth } from '../../context/auth/auth-provider';

const UNREAD_POLL_MS = 30_000;

// Keyed by user id, so another account on the device never sees cached notifications.
export const notificationKeys = {
  all: (userId: string | undefined) => ['notifications', userId] as const,
  inbox: (userId: string | undefined) => ['notifications', userId, 'inbox'] as const,
  unread: (userId: string | undefined) => ['notifications', userId, 'unread'] as const,
};

export function useNotifications() {
  const { user } = useAuth();
  return useInfiniteQuery({
    queryKey: notificationKeys.inbox(user?.id),
    queryFn: ({ pageParam }) => notificationsApi.listNotifications(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor,
    enabled: !!user,
  });
}

/** The bell's badge; re-read while the app is open. */
export function useUnreadCount(poll = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: notificationKeys.unread(user?.id),
    queryFn: notificationsApi.getUnreadCount,
    enabled: !!user,
    refetchInterval: poll ? UNREAD_POLL_MS : false,
    select: (d) => d.count,
  });
}

export function useMarkRead() {
  const { user } = useAuth();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[] | null) => notificationsApi.markRead(ids),
    onSuccess: () => client.invalidateQueries({ queryKey: notificationKeys.all(user?.id) }),
  });
}
