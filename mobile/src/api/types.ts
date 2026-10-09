export type UserRole = 'customer' | 'artist' | 'admin';

export interface User {
  id: string;
  phone: string;
  role: UserRole;
  is_phone_verified: boolean;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
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
