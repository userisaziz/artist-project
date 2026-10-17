import { request } from '../../core/api/client';
import { withQuery } from '../../core/api/query-string';
import type { ArtistCard, ArtistPublic, Availability, Page } from '../../core/api/types';

// Public artist directory (spec §1.3): no auth.
export interface DirectoryFilter {
  city?: string;
  category_id?: number | null;
  q?: string;
  limit?: number;
  cursor?: string | null;
}

export function listArtists(filter: DirectoryFilter = {}) {
  return request<Page<ArtistCard>>(withQuery('/artists', { ...filter }), undefined, { method: 'GET' });
}
export function getArtist(id: string) {
  return request<ArtistPublic>(`/artists/${encodeURIComponent(id)}`, undefined, { method: 'GET' });
}
export function getAvailability(artistId: string, date: string, serviceId: string) {
  return request<Availability>(withQuery(`/artists/${encodeURIComponent(artistId)}/availability`, { date, service_id: serviceId }), undefined, { method: 'GET' });
}
