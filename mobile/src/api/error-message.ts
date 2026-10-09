import { ApiError } from './types';

export const GENERIC_ERROR = 'Something went wrong. Please try again.';

/** Spec §4: screens switch on `code` (overrides), fall back to the server `message`, then to generic. */
export function errorMessage(e: unknown, overrides: Partial<Record<string, string>> = {}): string {
  if (e instanceof ApiError) return overrides[e.code] ?? (e.message || GENERIC_ERROR);
  return GENERIC_ERROR;
}
