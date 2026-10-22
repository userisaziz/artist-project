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
  refresh_token: string | null // null: the backend set it as the HttpOnly ac_refresh cookie instead
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

export type ArtistStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'suspended'
/** The Verification queue's statuses (and the custom-service queue's). */
export type ReviewStatus = 'pending' | 'approved' | 'rejected'

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
  /** Set on a pending profile that was approved or rejected before: a re-review after the artist's edits. */
  reviewed_at: string | null
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

/** GET /admin/overview?period=&city= : the date-range filter's choices. */
export type OverviewPeriod = 'today' | '7d' | '30d' | 'quarter'

/** Booking figures cover the chosen period (and city); `_previous` is the same-length period before it. */
export interface AdminOverview {
  period_days: number
  gross_paise: number // total of bookings created in the period, minus declined and expired
  gross_paise_previous: number
  bookings: number
  bookings_previous: number
  completed: number
  cancelled: number
  new_artists: number // approved during the period
  awaiting_artist: number
  pending_artists: number
  pending_custom_services: number
  flagged_reviews: number // reviews in `flagged`, waiting for a moderator
  bookings_by_week: { week_start: string; count: number }[] // 12 entries, oldest first; week_start is a YYYY-MM-DD date
  cities: string[] // every city with an approved artist, A to Z
}

/** published and flagged are public; hidden and removed are not. removed is final. */
export type ReviewModerationStatus = 'published' | 'flagged' | 'hidden' | 'removed'

/** Why a review needs a moderator: the auto-filter (contact_info, blocked_word) or the artist's report. */
export type ReviewFlag = 'contact_info' | 'blocked_word' | 'artist_report'

export type ReviewDecision = 'publish' | 'hide' | 'remove'

/** AdminReviewOut: the public review plus moderation state and who it is between. */
export interface AdminReview {
  id: string
  rating: number // 1–5
  text: string | null
  reviewer_name: string // "Priya S."
  service_name: string
  created_at: string
  reply: string | null
  replied_at: string | null
  status: ReviewModerationStatus
  flag: ReviewFlag | null
  report_reason: string | null
  moderator_note: string | null
  moderated_at: string | null // null: no moderator has decided on it yet
  artist: { id: string; business_name: string }
  customer: { id: string; name: string | null; phone: string }
  booking: { id: string; code: string; service_name: string }
}

export type ReviewPage = Page<AdminReview>

/** GET /admin/artists/directory: every non-draft artist ("all"), or one status. */
export type DirectoryStatus = 'all' | 'approved' | 'pending' | 'suspended' | 'on_hold' // on hold: an overdue profile requirement

export interface DirectoryRow {
  id: string
  business_name: string
  photo_url: string | null
  category: string | null // the first of the artist's categories
  city: string
  status: ArtistStatus
  rating_average: number | null // null until the first review
  rating_count: number
  bookings_total: number // completed, ever
  booking_value_30d: number // paise, completed in the last 30 days (paid to the artist directly)
  open_complaints: number | null // null until complaints are tracked
  created_at: string
  missing_requirements: string[] // keys of mandatory profile requirements not met yet, e.g. 'location'
}

export type DirectoryPage = Page<DirectoryRow>

export interface DirectorySummary {
  counts: Record<DirectoryStatus, number>
  active_artists: number
  new_this_month: number
  avg_rating: number | null
  total_reviews: number
  median_response_minutes: number | null
  at_risk: number // approved artists declining or cancelling over 8% of the last 30 days' bookings
}

/** POST /admin/artists/{id}/suspend and /reinstate */
export interface Suspension {
  id: string
  status: ArtistStatus
  suspension_reason: string | null
  suspended_at: string | null
}

/** GET /admin/requirements/{artist_id}: mandatory profile items an artist still has to add. */
export interface PendingRequirement {
  key: string
  title: string
  body: string
  action: string
  due_at: string // after this the artist is on hold
  overdue: boolean
}

export interface ArtistRequirements {
  on_hold: boolean
  items: PendingRequirement[]
}
