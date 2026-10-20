import { request } from '../../core/api/client';
import type { ArtistProfile } from '../../types/artist-onboarding/artist-onboarding';
import type { CustomServiceInput, CustomServicePatch } from '../../types/artist-services/artist-services';

// Custom services (catalog Part 2): approved artists only. Each waits for admin review; any edit sends it back.
export function addCustomService(body: CustomServiceInput) {
  return request<ArtistProfile>('/artists/me/custom-services', body, { auth: true });
}
export function updateCustomService(id: string, body: CustomServicePatch) {
  return request<ArtistProfile>(`/artists/me/custom-services/${encodeURIComponent(id)}`, body, { auth: true, method: 'PATCH' });
}
export function deleteCustomService(id: string) {
  return request<ArtistProfile>(`/artists/me/custom-services/${encodeURIComponent(id)}`, undefined, { auth: true, method: 'DELETE' });
}
