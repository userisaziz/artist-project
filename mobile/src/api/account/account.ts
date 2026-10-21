import { request } from '../../core/api/client';
import type { AccountDetails } from '../../types/account/account';
import type { ChosenRole, User } from '../../types/auth/auth';

// Each call returns the updated User so the gate can re-route at once.
export function updateMe(details: AccountDetails) {
  return request<User>('/users/me', details, { auth: true, method: 'PATCH' });
}
/** Anonymises the account server-side (204); the caller signs out afterwards. */
export function deleteAccount() {
  return request<void>('/users/me', undefined, { auth: true, method: 'DELETE' });
}
export function chooseRole(role: ChosenRole) {
  return request<User>('/users/me/role', { role }, { auth: true, method: 'PUT' });
}
