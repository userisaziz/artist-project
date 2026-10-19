// Mirrors backend app/customer/schemas.py. Phase 1 has no in-app payments: no spend or order value.
import type { BookingStatus } from '@/lib/types'

export type CustomerSegment = 'all' | 'new' | 'repeat' | 'blocked'
export type CustomerStatus = 'active' | 'new' | 'blocked'

export interface CustomerRow {
  id: string
  name: string
  phone: string
  email: string | null
  city: string | null
  bookings: number
  last_booking_at: string | null
  joined_at: string
  status: CustomerStatus
}

export interface CustomerPage {
  items: CustomerRow[]
  next_cursor: string | null
}

export interface CustomerSummary {
  counts: Record<CustomerSegment, number>
  monthly_active: number
  repeat_rate: number | null
}

export interface CustomerDetail extends CustomerRow {
  blocked_at: string | null
  blocked_reason: string | null
  reviews: number
  recent_bookings: {
    id: string
    code: string
    artist_name: string
    service_name: string
    start_at: string
    status: BookingStatus
    total_paise: number
  }[]
}
