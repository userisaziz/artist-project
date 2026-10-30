/** Mirrors backend app/notification/schemas.py (requests) and models.py (history rows). */
export type BroadcastSegment = 'all_users' | 'all_artists' | 'all_customers'

export interface BroadcastFilters {
  city?: string | null
  artist_status?: 'draft' | 'pending' | 'approved' | null
  category_id?: number | null
  joined_from?: string | null
  joined_to?: string | null
}

export interface BroadcastPreviewOut {
  recipients: number
  with_push: number
}

export interface BroadcastSentOut extends BroadcastPreviewOut {
  id: string
}

export interface AdminBroadcast {
  id: string
  title: string
  body: string
  link: string | null
  segment: string
  filters: BroadcastFilters
  recipient_count: number
  push_count: number
  created_at: string
}

export interface BroadcastPage {
  items: AdminBroadcast[]
  next_cursor: string | null
}
