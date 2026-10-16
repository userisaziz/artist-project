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

/** requested → confirmed → completed; a request can also be declined, expire unanswered, or be cancelled. */
export type BookingStatus = 'requested' | 'confirmed' | 'completed' | 'cancelled' | 'declined' | 'expired'

/** BookingOut: money is integer paise, copied onto the booking when it was requested. */
export interface Booking {
  id: string
  code: string // "BK-7F3K2Q"
  status: BookingStatus
  start_at: string
  end_at: string
  address: string
  note: string | null
  service_name: string
  duration_minutes: number
  artist: { id: string; business_name: string; photo_url: string | null; city: string }
  customer: { id: string; first_name: string | null; last_name: string | null }
  subtotal_paise: number
  platform_fee_paise: number
  total_paise: number
  deposit_paise: number
  balance_paise: number
  commission_paise: number
  artist_earning_paise: number
  deposit_paid_at: string | null
  expires_at: string
  decline_reason: string | null
  cancel_reason: string | null
  cancelled_by: 'customer' | 'artist' | 'admin' | null
  refund_due: boolean | null
  created_at: string
  responded_at: string | null // accepted or declined
  cancelled_at: string | null
  completed_at: string | null
}

/** AdminBookingOut: BookingOut plus the customer's phone. */
export interface AdminBooking extends Omit<Booking, 'customer'> {
  customer: Booking['customer'] & { phone: string }
}

export type BookingPage = Page<AdminBooking>

export interface AdminOverview {
  gross_paise_30d: number // total of bookings created in the last 30 days, minus declined and expired
  bookings_30d: number
  awaiting_artist: number
  completed_30d: number
  cancelled_30d: number
  pending_artists: number
  pending_custom_services: number
  bookings_by_week: { week_start: string; count: number }[] // 12 entries, oldest first; week_start is a YYYY-MM-DD date
}
