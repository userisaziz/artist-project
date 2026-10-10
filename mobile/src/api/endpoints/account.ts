import { request } from '../client';
import type { AccountDetails, ChosenRole, User } from '../types';

// Each call returns the updated User so the gate can re-route at once.
export function updateMe(details: AccountDetails) {
  return request<User>('/users/me', details, { auth: true, method: 'PATCH' });
}
export function chooseRole(role: ChosenRole) {
  return request<User>('/users/me/role', { role }, { auth: true, method: 'PUT' });
}
