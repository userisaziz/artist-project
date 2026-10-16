import type { BookingStatus } from '@/lib/types'

const AMBER = 'bg-[#FDF0DC] text-[#9A6514]'
const GREEN = 'bg-[#E3F1E7] text-[#2F6B47]'
const RED = 'bg-[#FBE3E3] text-[#A33A3A]'
export const NEUTRAL = 'bg-[#F2EEF0] text-[#6E5262]'

/** In the order the list's filter chips show them. */
export const BOOKING_STATUSES: { value: BookingStatus; label: string; className: string }[] = [
  { value: 'requested', label: 'Requested', className: AMBER },
  { value: 'confirmed', label: 'Confirmed', className: GREEN },
  { value: 'completed', label: 'Completed', className: NEUTRAL },
  { value: 'cancelled', label: 'Cancelled', className: RED },
  { value: 'declined', label: 'Declined', className: RED },
  { value: 'expired', label: 'Expired', className: NEUTRAL },
]

export const BY_VALUE = new Map(BOOKING_STATUSES.map((s) => [s.value, s]))

export const isBookingStatus = (value: string | null): value is BookingStatus => value !== null && BY_VALUE.has(value as BookingStatus)

/** Only these can still be cancelled by the admin. */
export const isOpen = (status: BookingStatus) => status === 'requested' || status === 'confirmed'

export const customerName = (c: { first_name: string | null; last_name: string | null }) =>
  [c.first_name, c.last_name].filter(Boolean).join(' ') || 'Customer'
