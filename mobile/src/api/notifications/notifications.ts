import { request } from '../../core/api/client';
import { withQuery } from '../../core/api/query-string';
import type { Page } from '../../core/api/types';
import type { PushToken } from '../../core/push/push';
import type { AppNotification } from '../../types/notifications/notifications';

// The signed-in person's notification inbox (backend app/notification/router.py).
export function listNotifications(cursor?: string | null) {
  return request<Page<AppNotification>>(withQuery('/notifications', { cursor }), undefined, { auth: true, method: 'GET' });
}
export function getUnreadCount() {
  return request<{ count: number }>('/notifications/unread-count', undefined, { auth: true, method: 'GET' });
}
/** `ids: null` marks everything read. */
export function markRead(ids: string[] | null) {
  return request<void>('/notifications/read', { ids }, { auth: true });
}
/** Idempotent: a token signed in on another account moves to this one. */
export function registerDevice(device: PushToken) {
  return request<void>('/notifications/devices', device, { auth: true });
}
export function removeDevice(device: PushToken) {
  return request<void>('/notifications/devices/remove', device, { auth: true });
}
