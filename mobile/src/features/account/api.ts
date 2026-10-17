import { request } from '../../core/api/client';
import type { AccountDetails } from './types';
import type { ChosenRole, User } from '../auth/types';

// Each call returns the updated User so the gate can re-route at once.
export function updateMe(details: AccountDetails) {
  return request<User>('/users/me', details, { auth: true, method: 'PATCH' });
}
export function chooseRole(role: ChosenRole) {
  return request<User>('/users/me/role', { role }, { auth: true, method: 'PUT' });
}
