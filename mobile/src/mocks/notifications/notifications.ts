import type { AppNotification } from '../../types/notifications/notifications';

// Mirrors backend NotificationOut (app/notification/schemas.py).
export function notificationFixture(overrides: Partial<AppNotification> = {}): AppNotification {
  return {
    id: 'n-1',
    kind: 'booking_accepted',
    title: 'Booking confirmed',
    body: 'Bridal Classic on Fri 9 Oct, 11:00 AM',
    link: '/customer/booking/b-1',
    read_at: null,
    created_at: '2026-10-09T09:00:00Z',
    ...overrides,
  };
}
