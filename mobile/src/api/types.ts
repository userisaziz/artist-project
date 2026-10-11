export type UserRole = 'customer' | 'artist' | 'admin';

export interface User {
  id: string;
  phone: string;
  /** Every role the account holds (backend order: customer, artist, admin). */
  roles: UserRole[];
  /** Which side of the app is showing; null until Choose role. Never admin. */
  active_role: ChosenRole | null;
  is_phone_verified: boolean;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
  whatsapp_booking_updates: boolean;
  /** True once Choose role is done; the gate routes on this and `active_role`. */
  is_onboarded: boolean;
}

/** What Choose role may set; admin is never self-assigned. */
export type ChosenRole = 'customer' | 'artist';

export interface AccountDetails {
  first_name: string;
  last_name: string | null;
  email: string | null;
  whatsapp_booking_updates: boolean;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: 'bearer';
  user: User;
}

/** Every failed API call becomes an ApiError — screens switch on `.code`, never on raw status. */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}
