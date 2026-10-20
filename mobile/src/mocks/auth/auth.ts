import type { TokenPair, User } from '../../types/auth/auth';

// Test fixtures mirroring backend app/user/schemas.py UserOut and app/auth/schemas.py TokenPair.

export const userFixture: User = {
  id: '6f1c2a5e-6a3b-4e8f-9d2a-1b7c3e4f5a60',
  phone: '+919876543210',
  roles: ['customer'],
  active_role: 'customer',
  is_phone_verified: true,
  is_onboarded: true,
  first_name: 'Asha',
  last_name: 'Rao',
  email: null,
  avatar_url: null,
  whatsapp_booking_updates: true,
};

export function tokenPairFixture(n = 1, user: User = userFixture): TokenPair {
  return { access_token: `access-${n}`, refresh_token: `refresh-${n}`, token_type: 'bearer', user };
}

/** FastAPI error bodies as the backend sends them: {code, message} (app/core/exceptions.py). */
export const authErrorBody = { code: 'auth_error', message: 'Authentication failed' };
export const serviceUnavailableBody = { code: 'service_unavailable', message: 'Service temporarily unavailable. Please try again.' };
