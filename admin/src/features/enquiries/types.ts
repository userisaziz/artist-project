/** Mirrors backend app/chat/schemas.py (EnquiryOut, EnquirySummary). */
export type EnquiryStatus = 'held' | 'allowed' | 'hidden'
export type EnquiryFilter = EnquiryStatus | 'all'

export interface Enquiry {
  id: string
  conversation_id: string
  sender: 'customer' | 'artist'
  text: string
  flag: string | null // contact_info | blocked_word
  status: EnquiryStatus
  created_at: string
  moderated_at: string | null
  customer: { id: string; name: string }
  artist: { id: string; name: string }
}

export interface EnquiryPage {
  items: Enquiry[]
  next_cursor: string | null
}

export interface EnquirySummary {
  counts: Record<EnquiryStatus, number>
  messages_7d: number // customers' messages to artists
  flagged_7d: number
}
