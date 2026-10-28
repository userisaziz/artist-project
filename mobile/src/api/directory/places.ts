import { request } from '../../core/api/client';
import { withQuery } from '../../core/api/query-string';
import type { NearbyArea, PlaceResult } from '../../types/directory/directory';

// Where customers look for artists (public, no auth). The same endpoints back artist onboarding through the catalog
// feature; these are the directory's own declarations so the two features stay independent.

/** Places matching what the customer typed (3+ characters); `near` ranks nearby matches first. */
export function searchPlaces(q: string, near: { latitude: number; longitude: number } | null) {
  return request<PlaceResult[]>(withQuery('/areas/search', { q, lat: near?.latitude, lng: near?.longitude }), undefined, { method: 'GET' });
}

/** The named area a point falls in; null outside every known area. */
export function nearestArea(lat: number, lng: number) {
  return request<NearbyArea | null>(withQuery('/areas/nearest', { lat, lng }), undefined, { method: 'GET' });
}
