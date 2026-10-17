import type { User } from '../core/api/types';

/** Which top-level area a user belongs to. Drives both the root gate guards and the `/` redirect hub. */
export type Destination = 'auth' | 'onboarding' | 'customer' | 'artist';

/**
 * Single source of truth for routing, from the account state the server returns.
 * Signup vs choose-role is resolved one level down inside (onboarding); the root only
 * needs to know the user is mid-onboarding. Once onboarded, `active_role` picks the area.
 */
export function destination(status: 'unauthenticated' | 'authenticated', user: User | null): Destination {
  if (status !== 'authenticated' || !user) return 'auth';
  if (!user.is_onboarded) return 'onboarding';
  return user.active_role === 'artist' ? 'artist' : 'customer';
}

/** Concrete landing path for an area, used by the `/` hub's <Redirect>. */
export function landingHref(dest: Destination, user: User | null): string {
  switch (dest) {
    case 'auth':
      return '/welcome';
    case 'onboarding':
      // A verified user with no name still owes sign-up details; otherwise they pick a role.
      return user?.first_name ? '/choose-role' : '/signup';
    case 'customer':
      return '/customer';
    case 'artist':
      return '/artist';
  }
}
