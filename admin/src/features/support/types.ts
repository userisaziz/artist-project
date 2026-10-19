// Mirrors backend app/support/schemas.py.
export type TicketStatus = 'new' | 'open' | 'waiting_on_user' | 'resolved'
export type TicketPriority = 'low' | 'normal' | 'urgent'
export type QueueView = 'open' | 'mine' | 'artists' | 'customers' | 'urgent' | 'resolved'
export type Topic = 'booking' | 'account'

export interface TicketMessage {
  id: string
  author: 'requester' | 'support'
  author_name: string
  text: string
  created_at: string
}

export interface Ticket {
  id: string
  code: string
  subject: string
  topic: Topic
  issue: string
  status: TicketStatus
  priority: TicketPriority
  channel: 'app' | 'phone'
  requester: { id: string; name: string; phone: string; side: 'customer' | 'artist' }
  assignee: { id: string; name: string } | null
  booking: { id: string; code: string; service_name: string; artist_name: string } | null
  created_at: string
  waiting_since: string | null
  messages: TicketMessage[]
}

export interface TicketPage {
  items: Ticket[]
  next_cursor: string | null
}

export interface SupportSummary {
  counts: Record<QueueView, number>
  first_response_minutes: number | null
  resolved_7d: number
}

/** The backend's issue lists (app/support/constants.py), for logging a phone request. */
export const ISSUES: Record<Topic, { value: string; label: string }[]> = {
  booking: [
    { value: 'artist_no_show', label: 'Artist didn’t show up' },
    { value: 'not_as_booked', label: 'Not what I booked' },
    { value: 'other', label: 'Something else about a booking' },
  ],
  account: [
    { value: 'cant_log_in', label: 'Can’t log in' },
    { value: 'change_number', label: 'Change my number' },
    { value: 'other', label: 'Something else about my account' },
  ],
}
