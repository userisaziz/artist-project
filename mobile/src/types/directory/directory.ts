import type { WeeklyHour } from '../../utils/common/weekly-hours';
import type { NamedRef } from '../../core/api/types';
import type { ServiceAddon } from '../catalog/catalog';

/** GET /artists list item: approved artists only. */
export interface ArtistCard {
  id: string;
  business_name: string;
  city: string;
  /** The area the artist works from ("Koramangala"); null for artists approved before the Location step. */
  locality: string | null;
  photo_url: string | null;
  cover_url: string | null;
  /** First few portfolio photos (Explore's mosaic). */
  photo_urls: string[];
  categories: NamedRef[];
  from_price_paise: number | null; // cheapest approved service; null if none yet
  /** Average of public reviews to one decimal; null ("New") when there are none. */
  rating: number | null;
  review_count: number;
  /** Km from the search point, one decimal; null without "Near me" or when the artist has no pin. */
  distance_km: number | null;
  /** The searched free date (YYYY-MM-DD) when the artist has an open slot then. */
  free_on: string | null;
}

/** GET /artists: one page plus every match across pages (null when not counted, e.g. a free-date search). */
export interface ArtistCardPage {
  items: ArtistCard[];
  next_cursor: string | null;
  total: number | null;
  /** The radius applied around near_lat/near_lng (the server widens 5, 10, 20 km until a few artists match); null
   *  without a point or when it had to drop the limit. */
  radius_km?: number | null;
}

/** GET /areas/search: one of our areas ("area") or, when none match, a place from the geocoder ("geocoder"),
 *  matched to the nearest of our areas when there is one. The coordinates are the search point either way. */
export interface PlaceResult {
  label: string; // "BTM Layout, Bangalore"
  name: string;
  city: string | null;
  latitude: number;
  longitude: number;
  area_id: number | null;
  source: 'area' | 'geocoder';
}

/** GET /areas/nearest: the named area a point falls in. */
export interface NearbyArea {
  id: number;
  city: string;
  name: string;
}

/** Where the customer is looking for artists: from the phone (gps), a searched area or place (search), or a whole
 *  city from a `?city=` link (city, no point). */
export interface CustomerPlace {
  label: string; // "BTM Layout, Bangalore", or the city
  city: string | null;
  areaId: number | null;
  coords: { latitude: number; longitude: number } | null;
  source: 'gps' | 'search' | 'city';
}

export type DirectorySort = 'recent' | 'recommended' | 'rating' | 'price' | 'nearest';

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
  /** The package's own photo (card size); null when it has none. */
  photo_url: string | null;
  /** "What's included" lines, in order. */
  included_items: string[];
  /** Priced extras the customer can pick when booking. */
  addons: ServiceAddon[];
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
  experience_years: number | null;
  /** Languages the artist speaks, in their order. */
  languages: string[];
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
