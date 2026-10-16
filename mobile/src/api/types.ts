export type UserRole = 'customer' | 'artist' | 'admin';

export interface User {
  id: string;
  phone: string;
  /** Every role the account holds (backend order: customer, artist, admin). */
  roles: UserRole[];
  /** Which side of the app is showing; null until Choose role. Never admin. */
  active_role: ChosenRole | null;
  is_phone_verified: boolean;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
  whatsapp_booking_updates: boolean;
  /** True once Choose role is done; the gate routes on this and `active_role`. */
  is_onboarded: boolean;
}

/** What Choose role may set; admin is never self-assigned. */
export type ChosenRole = 'customer' | 'artist';

export interface AccountDetails {
  first_name: string;
  last_name: string | null;
  email: string | null;
  whatsapp_booking_updates: boolean;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: 'bearer';
  user: User;
}

// ---- Artist onboarding (backend schemas/artist.py) ----

export type ArtistStatus = 'draft' | 'pending' | 'approved' | 'rejected';

/** A top-level category, flat: what an artist's own `categories` lists (backend CategoryOut). */
export interface Category {
  id: number;
  slug: string;
  name: string;
}

/** One service on the admin's list; artists pick it and set their own price and duration. */
export interface ServiceTemplate {
  id: number;
  name: string;
  description: string | null;
}

/** Slug is `parent-child`, e.g. `makeup-bridal`. */
export interface Subcategory {
  id: number;
  slug: string;
  name: string;
  services: ServiceTemplate[];
}

/** GET /categories: the public tree, active items only (backend CatalogCategoryOut). */
export interface CatalogCategory extends Category {
  subcategories: Subcategory[];
}

export type ServiceStatus = 'approved' | 'pending' | 'rejected';

/** One bookable service on the artist's menu. Prices are integer paise (₹1 = 100). */
export interface ServiceItem {
  id: string;
  category_id: number;
  /** Same value as category_id; rows from before subcategories point at a top-level category. */
  subcategory_id: number;
  template_id: number | null; // null = the artist's own (custom) service
  name: string;
  price_paise: number;
  duration_minutes: number;
  description: string | null;
  status: ServiceStatus; // onboarding picks from the admin's list, so those are approved at once
  rejection_reason: string | null;
}

/** Image URLs are built by the server from the storage key; the app never builds storage URLs. */
export interface PortfolioPhoto {
  id: string;
  key: string;
  width: number;
  height: number;
  thumb_url: string;
  card_url: string;
  full_url: string;
}

export interface ArtistProfile {
  id: string;
  status: ArtistStatus;
  business_name: string;
  city: string;
  bio: string | null;
  photo_key: string | null;
  photo_url: string | null;
  categories: Category[];
  services: ServiceItem[];
  photos: PortfolioPhoto[]; // first = cover
  /** Identity proof on file. Only the last 4 digits ever reach the app: never the number, keys or images. */
  kyc: { aadhaar_last4: string } | null;
  rejection_reason: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
}

export interface ProfileInput {
  business_name: string;
  city: string;
  category_ids: number[];
  photo_key: string | null;
  bio?: string | null;
}

/** POST /artists/me/services: a template from the catalog, with the artist's own price and duration. */
export interface ServiceInput {
  template_id: number;
  price_paise: number;
  duration_minutes: number;
  description?: string | null;
}

export interface PhotoInput {
  key: string;
  width: number;
  height: number;
}

/** PUT /artists/me/kyc. All three are required on every call ("Replace details" re-sends everything). */
export interface KycInput {
  aadhaar_number: string;
  front_key: string;
  back_key: string;
}

export type UploadPurpose = 'artist_photo' | 'portfolio' | 'aadhaar';

/** POST `fields` plus the image (form field `file`) to `upload_url`, then send `key` to our API. */
export interface UploadTicket {
  upload_url: string;
  fields: Record<string, string>;
  key: string;
}

// ---- Discovery and bookings (spec Increment 5 §1.3–§1.5) ----

/** Cursor-paginated list (backend `{items, next_cursor}`). */
export interface Page<T> {
  items: T[];
  next_cursor: string | null;
}

export interface NamedRef {
  id: number;
  name: string;
}

/** GET /artists list item: approved artists only. */
export interface ArtistCard {
  id: string;
  business_name: string;
  city: string;
  photo_url: string | null;
  cover_url: string | null;
  categories: NamedRef[];
  from_price_paise: number | null; // cheapest approved service; null if none yet
}

export interface PublicService {
  id: string;
  name: string;
  description: string | null;
  price_paise: number;
  duration_minutes: number;
  category: NamedRef | null;
  subcategory: NamedRef | null;
}

/** GET /artists/{id}: the storefront. Never carries KYC, phone, rejection reason or unapproved services. */
export interface ArtistPublic extends ArtistCard {
  bio: string | null;
  photos: { id: string; url: string; thumb_url: string }[];
  services: PublicService[];
  member_since: string | null;
  completed_bookings: number;
}

export interface Slot {
  start_at: string;
  available: boolean;
}

/** GET /artists/{id}/availability: hourly IST slots for one date. */
export interface Availability {
  date: string;
  slots: Slot[];
}

export type BookingStatus = 'requested' | 'confirmed' | 'declined' | 'expired' | 'cancelled' | 'completed';
export type CancelledBy = 'customer' | 'artist' | 'admin';

export interface BookingInput {
  artist_id: string;
  service_id: string;
  start_at: string;
  address: string;
  note?: string | null;
}

/** BookingOut: money is integer paise, copied onto the booking when it is created. */
export interface Booking {
  id: string;
  code: string;
  status: BookingStatus;
  start_at: string;
  end_at: string;
  address: string;
  note: string | null;
  service_name: string;
  duration_minutes: number;
  artist: { id: string; business_name: string; photo_url: string | null; city: string };
  customer: { id: string; first_name: string | null; last_name: string | null };
  subtotal_paise: number;
  platform_fee_paise: number;
  total_paise: number;
  deposit_paise: number;
  balance_paise: number;
  /** Artist and admin responses only: customer-facing responses carry null. */
  commission_paise: number | null;
  artist_earning_paise: number | null;
  deposit_paid_at: string | null;
  /** min(created + 3h, start_at): a request close to its start must be answered before it begins. */
  expires_at: string;
  responded_at: string | null;
  cancelled_at: string | null;
  completed_at: string | null;
  decline_reason: string | null;
  cancel_reason: string | null;
  cancelled_by: CancelledBy | null;
  refund_due: boolean | null;
  created_at: string;
}

export type CustomerBookingScope = 'upcoming' | 'past';
export type ArtistBookingScope = 'requests' | 'upcoming' | 'past';

/** GET /artists/me/dashboard */
export interface ArtistDashboard {
  requests: number;
  upcoming: number;
  completed_this_month: number;
  earnings_this_month_paise: number;
  today: Booking[];
}

/** Every failed API call becomes an ApiError — screens switch on `.code`, never on raw status. */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}
