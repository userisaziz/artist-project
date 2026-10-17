// Review auto-filter (spec Increment 6 §1.3), the same rules as backend app/utils/review_filter.py — keep them in lockstep.
// Pure: the mock runs it before publishing a review; a match makes the review `hidden` with the returned flag.

export type ReviewFilterFlag = 'contact_info' | 'blocked_word';

/** Backend settings.review_blocked_words default. */
export const DEFAULT_BLOCKED_WORDS: readonly string[] = ['scam', 'fraud', 'call me', 'whatsapp me'];

const CONTACT_PATTERNS: readonly RegExp[] = [
  /(?<![\d-])(?:\+?91[\s.-]?)?\(?[6-9]\d{4}\)?[\s.-]?\d{5}(?!\d)/, // Indian mobile, with or without +91, spaces, dots or dashes
  /\(?\b\d{3}\)?[\s.-]?\d{3}[\s.-]\d{4}\b/, // 3-3-4 numbers, e.g. (555) 123-4567
  /\d{10,}/, // any run of 10 or more digits
  /[\w.+-]+@[\w-]+\.[\w.-]+/, // email
  /(?<![\w.])@[A-Za-z0-9_.]{2,}/, // @handle
  /https?:\/\/|\bwww\.|\b[\w-]+\.(?:com|in|me|co|net|org|io|app|link)\b/i, // link or bare domain
];

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Case-insensitive whole-phrase match, like the backend's `\b<phrase>\b`. */
const phrasePattern = (phrase: string) => new RegExp(`\\b${escapeRegExp(phrase)}\\b`, 'i');

/** The first flag the text trips (contact details before blocked words), or null when it is clean. */
export function reviewFlag(text: string, blockedWords: readonly string[] = DEFAULT_BLOCKED_WORDS): ReviewFilterFlag | null {
  if (CONTACT_PATTERNS.some((re) => re.test(text))) return 'contact_info';
  if (blockedWords.some((w) => w && phrasePattern(w).test(text))) return 'blocked_word';
  return null;
}
