const MINUTE_MS = 60_000
const HOUR_MINUTES = 60
const DAY_MINUTES = 24 * HOUR_MINUTES

/** How long the requester has been waiting: '4 min', '3h', '2d'; '—' when nothing awaits support. */
export function waitingFor(since: string | null, now: number): string {
  if (!since) return '—'
  const minutes = Math.max(0, Math.floor((now - Date.parse(since)) / MINUTE_MS))
  if (minutes < HOUR_MINUTES) return `${minutes} min`
  if (minutes < DAY_MINUTES) return `${Math.floor(minutes / HOUR_MINUTES)}h`
  return `${Math.floor(minutes / DAY_MINUTES)}d`
}
