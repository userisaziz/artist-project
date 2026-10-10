// API contract types, mirroring backend/app/schemas (user.py, artist.py, category.py).

export type UserRole = 'customer' | 'artist' | 'admin'

export interface User {
  id: string
  phone: string
  roles: UserRole[] // an account can hold several, e.g. ['customer', 'artist', 'admin']
  active_role: 'customer' | 'artist' | null // the mobile app's side; irrelevant here
  first_name: string | null
  last_name: string | null
  email: string | null
}

export interface TokenPair {
  access_token: string
  refresh_token: string
  user: User
}

export interface AdminCategory {
  id: number
  slug: string
  name: string
  sort_order: number
  is_active: boolean
  artist_count: number
  service_count: number
}

export interface CategoryInput {
  name: string
  slug?: string
  sort_order?: number
  is_active: boolean
}

export type ArtistStatus = 'draft' | 'pending' | 'approved' | 'rejected'
export type ReviewStatus = Exclude<ArtistStatus, 'draft'>

export interface Service {
  id: string
  category_id: number
  name: string
  price_paise: number
  duration_minutes: number
  description: string | null
}

export interface Photo {
  id: string
  key: string
  width: number
  height: number
  thumb_url: string
  card_url: string
  full_url: string
}

export interface ArtistSummary {
  id: string
  status: ArtistStatus
  business_name: string
  city: string
  photo_url: string | null
  categories: string[]
  service_count: number
  photo_count: number
  submitted_at: string | null
}

export interface ArtistDetail {
  id: string
  status: ArtistStatus
  business_name: string
  city: string
  bio: string | null
  photo_url: string | null
  categories: { id: number; slug: string; name: string }[]
  services: Service[]
  photos: Photo[]
  rejection_reason: string | null
  submitted_at: string | null
  reviewed_at: string | null
  owner: { id: string; phone: string; first_name: string | null; last_name: string | null; email: string | null }
}

export interface Page<T> {
  items: T[]
  next_cursor: string | null
}
