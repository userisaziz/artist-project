import type { WeeklyHour } from '../../utils/common/weekly-hours';
import type { NamedRef } from '../../core/api/types';

/** GET /artists list item: approved artists only. */
export interface ArtistCard {
  id: string;
  business_name: string;
  city: string;
  photo_url: string | null;
  cover_url: string | null;
  categories: NamedRef[];
  from_price_paise: number | null; // cheapest approved service; null if none yet
  /** Average of public reviews to one decimal; null ("New") when there are none. */
  rating: number | null;
  review_count: number;
}

export interface PublicService {
  id: string;
  name: string;
  description: string | null;
  price_paise: number;
  duration_minutes: number;
  category: NamedRef | null;
  subcategory: NamedRef | null;
  /** Completed bookings of this package; the storefront badges the highest as "Most booked". */
  booking_count: number;
}

/** GET /artists/{id}: the storefront. Never carries KYC, phone, rejection reason or unapproved services. */
export interface ArtistPublic extends ArtistCard {
  bio: string | null;
  photos: { id: string; url: string; thumb_url: string }[];
  services: PublicService[];
  member_since: string | null;
  /** 7 days, weekday 0 = Monday; the slots offered follow these. */
  hours: WeeklyHour[];
  /** Display only: how far the artist travels, in km. */
  travel_radius_km: number | null;
  completed_bookings: number;
  /** First IST day (YYYY-MM-DD) with an open slot within two weeks; null when fully booked or no packages. */
  next_free_date: string | null;
  /** Median minutes to answer a customer; null until the artist has replied a few times. */
  reply_minutes: number | null;
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
