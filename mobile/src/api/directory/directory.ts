import { request } from '../../core/api/client';
import { withQuery } from '../../core/api/query-string';
import type { ArtistCardPage, ArtistPublic, Availability, DirectorySort } from '../../types/directory/directory';

// Public artist directory (spec §1.3): no auth.
export interface DirectoryFilter {
  city?: string;
  category_id?: number | null;
  q?: string;
  min_rating?: number | null;
  max_price_paise?: number | null;
  home_visit?: boolean;
  available_on?: string | null; // YYYY-MM-DD, IST
  near_lat?: number | null;
  near_lng?: number | null;
  sort?: DirectorySort;
  limit?: number;
  cursor?: string | null;
}

export function listArtists(filter: DirectoryFilter = {}) {
  const { home_visit, ...rest } = filter;
  const query = { ...rest, home_visit: home_visit ? 'true' : undefined };
  return request<ArtistCardPage>(withQuery('/artists', query), undefined, { method: 'GET' });
}
export function getArtist(id: string) {
  return request<ArtistPublic>(`/artists/${encodeURIComponent(id)}`, undefined, { method: 'GET' });
}
export function getAvailability(artistId: string, date: string, serviceId: string) {
  return request<Availability>(withQuery(`/artists/${encodeURIComponent(artistId)}/availability`, { date, service_id: serviceId }), undefined, { method: 'GET' });
}
