import { request } from '../../core/api/client';
import type { AddressInput, SavedAddress } from '../../types/addresses/addresses';

const MINE = '/users/me/addresses';

/** Most recently used first. */
export function listAddresses() {
  return request<SavedAddress[]>(MINE, undefined, { auth: true, method: 'GET' });
}
/** Saving the same text again returns the existing address (with the new label). */
export function addAddress(body: AddressInput) {
  return request<SavedAddress>(MINE, body, { auth: true });
}
export function updateAddress(id: string, body: Partial<AddressInput>) {
  return request<SavedAddress>(`${MINE}/${encodeURIComponent(id)}`, body, { auth: true, method: 'PATCH' });
}
export function deleteAddress(id: string) {
  return request<void>(`${MINE}/${encodeURIComponent(id)}`, undefined, { auth: true, method: 'DELETE' });
}
export function markAddressUsed(id: string) {
  return request<void>(`${MINE}/${encodeURIComponent(id)}/used`, undefined, { auth: true });
}
