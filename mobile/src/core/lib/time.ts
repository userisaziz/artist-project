// IST (Asia/Kolkata, UTC+05:30, no daylight saving) helpers. Slots, calendars and labels are all in IST,
// whatever the device's own time zone, so these do the arithmetic by hand instead of relying on Intl.

const IST_OFFSET_MS = 330 * 60_000;
const DAY_MS = 86_400_000;
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const URGENT_MS = 30 * 60_000;

type Instant = number | string;
const toMs = (t: Instant) => (typeof t === 'number' ? t : Date.parse(t));
/** A Date whose UTC fields read as the IST wall clock. */
const istClock = (t: Instant) => new Date(toMs(t) + IST_OFFSET_MS);
const pad = (n: number) => String(n).padStart(2, '0');

/** 'YYYY-MM-DD' of the IST calendar day containing `t`. */
export function istDateKey(t: Instant): string {
  const d = istClock(t);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** The instant (ms) of IST midnight at the start of `dateKey`; NaN for a malformed key. */
export function istDayStart(dateKey: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return NaN;
  return Date.parse(`${dateKey}T00:00:00.000Z`) - IST_OFFSET_MS;
}

export function addDays(dateKey: string, days: number): string {
  return istDateKey(istDayStart(dateKey) + days * DAY_MS);
}

/** IST hour of day, 0–23. */
export function istHour(t: Instant): number {
  return istClock(t).getUTCHours();
}

export function formatTime(t: Instant): string {
  const d = istClock(t);
  const h = d.getUTCHours();
  return `${h % 12 || 12}:${pad(d.getUTCMinutes())} ${h < 12 ? 'AM' : 'PM'}`;
}

/** 'Fri, 9 Oct' */
export function formatDay(dateKey: string): string {
  const d = istClock(istDayStart(dateKey));
  return `${DAYS[d.getUTCDay()].slice(0, 3)}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()].slice(0, 3)}`;
}

/** 'Thursday, 8 October' */
export function formatLongDay(dateKey: string): string {
  const d = istClock(istDayStart(dateKey));
  return `${DAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** 'Fri, 9 Oct · 11:00 AM' */
export function formatWhen(t: Instant): string {
  return `${formatDay(istDateKey(t))} · ${formatTime(t)}`;
}

/** 'October 2026' */
export function formatMonth(year: number, month: number): string {
  return `${MONTHS[month - 1]} ${year}`;
}

/** 'Oct 2026', for "On Atelier since". */
export function formatMonthShort(t: Instant): string {
  const d = istClock(t);
  return `${MONTHS[d.getUTCMonth()].slice(0, 3)} ${d.getUTCFullYear()}`;
}

/** Day-of-week initial and day number for a date strip: { weekday: 'Fri', day: 9 }. */
export function dayParts(dateKey: string) {
  const d = istClock(istDayStart(dateKey));
  return { weekday: DAYS[d.getUTCDay()].slice(0, 3), day: d.getUTCDate() };
}

export function greeting(now: number): string {
  const h = istHour(now);
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/** Countdown to an artist's answer deadline: '2h 14m left', urgent under 30 minutes. */
export function timeLeft(deadline: Instant, now: number) {
  const ms = toMs(deadline) - now;
  if (ms <= 0) return { label: 'Expired', urgent: true, over: true };
  const minutes = Math.floor(ms / 60_000);
  const h = Math.floor(minutes / 60);
  const label = h ? `${h}h ${minutes % 60}m left` : `${minutes}m left`;
  return { label, urgent: ms < URGENT_MS, over: false };
}

/** Date keys of a month (1-based), padded with nulls into whole Sunday-first weeks. */
export function monthGrid(year: number, month: number): (string | null)[] {
  const first = `${year}-${pad(month)}-01`;
  const lead = istClock(istDayStart(first)).getUTCDay();
  const days: string[] = [];
  for (let key = first; key.startsWith(`${year}-${pad(month)}`); key = addDays(key, 1)) days.push(key);
  const cells: (string | null)[] = [...Array<null>(lead).fill(null), ...days];
  const tail = (7 - (cells.length % 7)) % 7;
  return [...cells, ...Array<null>(tail).fill(null)];
}

/** First and last date keys of a month, for calendar range queries. */
export function monthRange(year: number, month: number) {
  const from = `${year}-${pad(month)}-01`;
  const next = month === 12 ? `${year + 1}-01-01` : `${year}-${pad(month + 1)}-01`;
  return { from, to: addDays(next, -1) };
}
