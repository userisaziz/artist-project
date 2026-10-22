/** Languages an artist can talk to clients in; the same list and order as the backend's Language enum. */
export const LANGUAGES = ['English', 'Hindi', 'Kannada', 'Tamil', 'Telugu', 'Malayalam', 'Marathi', 'Bengali', 'Gujarati', 'Punjabi', 'Urdu'] as const;

export const MAX_EXPERIENCE_YEARS = 60; // backend ProfileIn.experience_years

export type ExperienceResult = { ok: true; value: number | null } | { ok: false; error: string };

/** The Profile step's "Years of experience" text: blank means not given; otherwise whole years from 0 to 60. */
export function parseExperience(text: string): ExperienceResult {
  const trimmed = text.trim();
  if (!trimmed) return { ok: true, value: null };
  const years = Number(trimmed);
  if (!/^\d+$/.test(trimmed) || years > MAX_EXPERIENCE_YEARS) {
    return { ok: false, error: `Enter your years of experience as a number from 0 to ${MAX_EXPERIENCE_YEARS}.` };
  }
  return { ok: true, value: years };
}
