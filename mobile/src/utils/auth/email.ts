const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; // the backend's EmailStr accepts at least this

export const BAD_EMAIL = 'Enter a valid email, or leave it empty.';

/** Email is optional: empty is fine, otherwise it must look like an address. */
export function isValidOptionalEmail(email: string): boolean {
  const trimmed = email.trim();
  return !trimmed || EMAIL_RE.test(trimmed);
}
