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

export interface Category {
  id: number;
  slug: string;
  name: string;
}

/** One bookable service on the artist's menu. Prices are integer paise (₹1 = 100). */
export interface ServiceItem {
  id: string;
  category_id: number;
  name: string;
  price_paise: number;
  duration_minutes: number;
  description: string | null;
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

export interface ServiceInput {
  category_id: number;
  name: string;
  price_paise: number;
  duration_minutes: number;
  description?: string | null;
}

export interface PhotoInput {
  key: string;
  width: number;
  height: number;
}

export type UploadPurpose = 'artist_photo' | 'portfolio';

/** POST `fields` plus the image (form field `file`) to `upload_url`, then send `key` to our API. */
export interface UploadTicket {
  upload_url: string;
  fields: Record<string, string>;
  key: string;
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
