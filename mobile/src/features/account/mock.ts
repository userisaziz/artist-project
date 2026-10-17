import type { TransportResponse } from '../../core/api/transport';
import { err, ok } from '../../core/api/mock/respond';
import type { Body } from '../../core/api/mock/respond';
import type { User, UserRole } from '../auth/types';

// PATCH /users/me and PUT /users/me/role, same rules as backend services/user_service.py — keep them in lockstep.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLE_ORDER: UserRole[] = ['customer', 'artist', 'admin']; // backend UserOut sorts roles in this order
const ACCOUNT_ROUTES = new Set(['PATCH /users/me', 'PUT /users/me/role']); // all need a Bearer token

export const isAccountRoute = (method: string, path: string) => ACCOUNT_ROUTES.has(`${method} ${path}`);

/** `users` is every account keyed by phone; a write replaces the signed-in user's entry. */
export function handleAccount(users: Map<string, User>, user: User, path: string, payload: Body): TransportResponse {
  if (path === '/users/me') return updateMe(users, user, payload);
  return chooseRole(users, user, typeof payload.role === 'string' ? payload.role : undefined);
}

function save(users: Map<string, User>, user: User): User {
  users.set(user.phone, user);
  return user;
}

function updateMe(users: Map<string, User>, user: User, b: Body): TransportResponse {
  const email = typeof b.email === 'string' && b.email.trim() ? b.email.trim() : null;
  if (typeof b.first_name !== 'string' || !b.first_name.trim()) return err('validation_error', 'first_name is required', 422);
  if (email && !EMAIL_RE.test(email)) return err('validation_error', 'email is not a valid address', 422);
  const taken = email && [...users.values()].some((u) => u.id !== user.id && u.email?.toLowerCase() === email.toLowerCase());
  if (taken) return err('conflict', 'That email is already in use', 409);
  return ok(save(users, {
    ...user,
    first_name: b.first_name.trim(),
    last_name: typeof b.last_name === 'string' && b.last_name.trim() ? b.last_name.trim() : null,
    email,
    whatsapp_booking_updates: b.whatsapp_booking_updates !== false,
  }));
}

/** Same rules as backend UserService.choose_role: grant the role if new, then show that side (also "switch side"). */
function chooseRole(users: Map<string, User>, user: User, role: string | undefined): TransportResponse {
  if (role !== 'customer' && role !== 'artist') return err('validation_error', 'role must be customer or artist', 422);
  const roles = ROLE_ORDER.filter((r) => r === role || user.roles.includes(r));
  return ok(save(users, { ...user, roles, active_role: role, is_onboarded: true }));
}
