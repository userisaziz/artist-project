// Mirrors backend app/feed/schemas.py (AdminPostOut, AdminFeedSummary).
export type FeedView = 'all' | 'featured' | 'reported' | 'hidden'
export type Moderation = 'live' | 'hidden' | 'removed'
export type Decision = 'keep' | 'hide' | 'remove'

export interface AdminPost {
  id: string
  kind: 'photos' | 'article'
  topic: 'look' | 'guide' | 'story'
  title: string | null
  text: string | null
  excerpt: string | null
  cover_url: string | null
  photos: { url: string; width: number; height: number }[]
  artist: { id: string; business_name: string; city: string }
  like_count: number
  featured: boolean
  moderation: Moderation
  report_count: number
  moderation_note: string | null
  created_at: string
}

export interface AdminPostPage {
  items: AdminPost[]
  next_cursor: string | null
}

export interface FeedSummary {
  counts: Record<FeedView, number>
  posts_7d: number
  featured_slots: number
}
