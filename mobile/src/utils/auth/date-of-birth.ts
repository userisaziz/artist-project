// Same rules as backend app/user/schemas.py + app/user/service.py (keep them in lockstep): a real calendar
// date, not in the future, at least MIN_AGE_YEARS full years old. The API speaks ISO (YYYY-MM-DD); the field
// shows DD/MM/YYYY, the way the rest of the app writes a date. There is no date picker in this app, so the
// input is a masked number field — the same trick as src/utils/artist-onboarding/aadhaar.ts.
export const MIN_AGE_YEARS = 18;

export const BAD_DOB = 'Enter your date of birth as DD/MM/YYYY.';
export const FUTURE_DOB = 'Date of birth cannot be in the future.';
export const TOO_YOUNG = `You must be at least ${MIN_AGE_YEARS} years old to continue.`;

/** Digits only, grouped DD/MM/YYYY: typing "12041995" or "12/04/1995" both read as 12 April 1995. */
export function formatDateOfBirth(input: string): string {
  const digits = input.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** Days in `month` (1 = January) for `year`; February follows the leap year. */
function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** "12/04/1995" → "1995-04-12"; anything that is not a real calendar date becomes null. */
export function parseDateOfBirth(formatted: string): string | null {
  const parts = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(formatted);
  if (!parts) return null;
  const day = Number(parts[1]);
  const month = Number(parts[2]);
  const year = Number(parts[3]);
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;
  return `${parts[3]}-${pad(month)}-${pad(day)}`;
}

/** "1995-04-12" → "12/04/1995", so a saved account pre-fills the field. */
export function dateOfBirthInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const parts = iso.split('-');
  if (parts.length !== 3 || parts.some((p) => !/^\d+$/.test(p))) return '';
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

/** Full years lived on `today` — the same month/day comparison the backend does. */
export function ageYears(iso: string, today: Date): number {
  const month = Number(iso.slice(5, 7));
  const day = Number(iso.slice(8, 10));
  const notYet = today.getUTCMonth() + 1 < month || (today.getUTCMonth() + 1 === month && today.getUTCDate() < day);
  return today.getUTCFullYear() - Number(iso.slice(0, 4)) - (notYet ? 1 : 0);
}

export type DateOfBirthResult = { iso: string; error: null } | { iso: null; error: string };

/**
 * The field's single question: is this text a date of birth the API will accept?
 * `today` defaults to the device clock, so a test can pin the 18-year line.
 */
export function readDateOfBirth(formatted: string, today = new Date()): DateOfBirthResult {
  const iso = parseDateOfBirth(formatted);
  if (!iso) return { iso: null, error: BAD_DOB };
  if (iso > today.toISOString().slice(0, 10)) return { iso: null, error: FUTURE_DOB };
  if (ageYears(iso, today) < MIN_AGE_YEARS) return { iso: null, error: TOO_YOUNG };
  return { iso, error: null };
}
