import type { Category } from '../catalog/catalog';

export type ArtistStatus = 'draft' | 'pending' | 'approved' | 'rejected';

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
