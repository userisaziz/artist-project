// API contract types, mirroring backend/app/schemas (user.py, artist.py, category.py, service_template.py).

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

/** draft: admin-only while being set up. inactive: no new picks, existing artists keep it. active: public. */
export type CategoryStatus = 'draft' | 'inactive' | 'active'

export interface AdminCategory {
  id: number
  slug: string
  name: string
  sort_order: number
  status: CategoryStatus
  parent_id: number | null
  artist_count: number
  service_count: number
  child_count: number
  template_count: number
}

export interface CategoryInput {
  name: string
  slug?: string
  sort_order?: number
  status: CategoryStatus
  parent_id?: number // set on create only: makes it a subcategory of that top-level category
}

/** One entry in a subcategory's service list, which artists pick from during onboarding. */
export interface ServiceTemplate {
  id: number
  subcategory_id: number
  name: string
  description: string | null
  sort_order: number
  is_active: boolean
  artist_count: number
}

export interface ServiceTemplateInput {
  subcategory_id: number // create only; a template stays where it was created
  name: string
  description: string | null
  sort_order?: number
  is_active: boolean
}

export type ArtistStatus = 'draft' | 'pending' | 'approved' | 'rejected'
export type ReviewStatus = Exclude<ArtistStatus, 'draft'>

/** Picked-from-the-list services are approved on creation; custom ones wait for admin review. */
export type ServiceStatus = 'approved' | 'pending' | 'rejected'

export interface Service {
  id: string
  category_id: number
  subcategory_id: number // the same column; older rows point straight at a top-level category
  template_id: number | null // null = the artist's own custom service
  name: string
  price_paise: number
  duration_minutes: number
  description: string | null
  status: ServiceStatus
  rejection_reason: string | null
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

/** Admin-only view of the artist's Aadhaar: the number is masked, and both links are private and expire after 5 minutes. */
export interface AdminKyc {
  aadhaar_masked: string // "•••• •••• 2346"
  front_url: string
  back_url: string
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
  kyc: AdminKyc | null // null: submitted before Aadhaar verification existed
  rejection_reason: string | null
  submitted_at: string | null
  reviewed_at: string | null
  owner: { id: string; phone: string; first_name: string | null; last_name: string | null; email: string | null }
}

export interface CustomServiceItem {
  id: string
  artist_id: string
  business_name: string
  category: { id: number; name: string } | null // null for older rows that point straight at a top-level category
  subcategory: { id: number; name: string }
  name: string
  price_paise: number
  duration_minutes: number
  description: string | null
  status: ServiceStatus
  rejection_reason: string | null
  created_at: string
}

export interface Page<T> {
  items: T[]
  next_cursor: string | null
}

export type CustomServicePage = Page<CustomServiceItem>
