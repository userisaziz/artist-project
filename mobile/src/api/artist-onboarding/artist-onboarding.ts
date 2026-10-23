import { request } from '../../core/api/client';
import { ApiError } from '../../core/api/types';
import type { ArtistProfile, DetailsInput, KycInput, LocationInput, MyRequirements, PhotoInput, ProfileInput, ServiceInput, UploadPurpose, UploadTicket } from '../../types/artist-onboarding/artist-onboarding';

// Mirrors backend api/v1/artists.py + uploads.py. Every write returns the whole profile.

/** null until the first Profile save (the backend answers 404 not_found). */
export async function getMyProfile(): Promise<ArtistProfile | null> {
  try {
    return await request<ArtistProfile>('/artists/me', undefined, { auth: true, method: 'GET' });
  } catch (e) {
    if (e instanceof ApiError && e.code === 'not_found') return null;
    throw e;
  }
}
export function saveProfile(body: ProfileInput) {
  return request<ArtistProfile>('/artists/me/profile', body, { auth: true, method: 'PUT' });
}
export function saveLocation(body: LocationInput) {
  return request<ArtistProfile>('/artists/me/location', body, { auth: true, method: 'PUT' });
}
export function updateDetails(body: DetailsInput) {
  return request<ArtistProfile>('/artists/me/details', body, { auth: true, method: 'PATCH' });
}
export function getMyRequirements() {
  return request<MyRequirements>('/artists/me/requirements', undefined, { auth: true, method: 'GET' });
}
export function addService(body: ServiceInput) {
  return request<ArtistProfile>('/artists/me/services', body, { auth: true });
}
export function deleteService(id: string) {
  return request<ArtistProfile>(`/artists/me/services/${id}`, undefined, { auth: true, method: 'DELETE' });
}
export function addPhoto(body: PhotoInput) {
  return request<ArtistProfile>('/artists/me/photos', body, { auth: true });
}
export function deletePhoto(id: string) {
  return request<ArtistProfile>(`/artists/me/photos/${id}`, undefined, { auth: true, method: 'DELETE' });
}
export function reorderPhotos(photoIds: string[]) {
  return request<ArtistProfile>('/artists/me/photos/order', { photo_ids: photoIds }, { auth: true, method: 'PUT' });
}
export function saveKyc(body: KycInput) {
  return request<ArtistProfile>('/artists/me/kyc', body, { auth: true, method: 'PUT' });
}
/** An approved profile back to draft for editing; it leaves the directory until re-approved. */
export function reopenProfile() {
  return request<ArtistProfile>('/artists/me/reopen', undefined, { auth: true });
}
export function submitProfile() {
  return request<ArtistProfile>('/artists/me/submit', undefined, { auth: true });
}
export function uploadTicket(purpose: UploadPurpose) {
  return request<UploadTicket>('/uploads/signature', { purpose }, { auth: true });
}
