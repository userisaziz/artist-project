import type { BookingStatus } from '@/lib/types'

/** In the order the list's filter chips show them; `tone` is the status pill's Badge variant. */
export const BOOKING_STATUSES: { value: BookingStatus; label: string; tone: 'warning' | 'success' | 'neutral' | 'danger' }[] = [
  { value: 'requested', label: 'Requested', tone: 'warning' },
  { value: 'confirmed', label: 'Confirmed', tone: 'success' },
  { value: 'completed', label: 'Completed', tone: 'neutral' },
  { value: 'cancelled', label: 'Cancelled', tone: 'danger' },
  { value: 'declined', label: 'Declined', tone: 'danger' },
  { value: 'expired', label: 'Expired', tone: 'neutral' },
]

export const BY_VALUE = new Map(BOOKING_STATUSES.map((s) => [s.value, s]))

export const isBookingStatus = (value: string | null): value is BookingStatus => value !== null && BY_VALUE.has(value as BookingStatus)

/** Only these can still be cancelled by the admin. */
export const isOpen = (status: BookingStatus) => status === 'requested' || status === 'confirmed'

export const customerName = (c: { first_name: string | null; last_name: string | null }) =>
  [c.first_name, c.last_name].filter(Boolean).join(' ') || 'Customer'
