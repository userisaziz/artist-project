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
  /** ISO date (YYYY-MM-DD). Asked at sign-up, required on every details save, and 18+ server-side. */
  date_of_birth?: string | null;
  email?: string | null;
  avatar_url?: string | null;
  whatsapp_booking_updates: boolean;
  /** True once Choose role is done; the gate routes on this and `active_role`. */
  is_onboarded: boolean;
}

/** What Choose role may set; admin is never self-assigned. */
export type ChosenRole = 'customer' | 'artist';

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: 'bearer';
  user: User;
}
