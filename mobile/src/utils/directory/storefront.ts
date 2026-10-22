import type { PublicService } from '../../types/directory/directory';

const MINUTES_PER_HOUR = 60;

/** The stats card's "Replies in": "10m" under an hour, "3h" after. */
export function formatReplyTime(minutes: number): string {
  if (minutes < MINUTES_PER_HOUR) return `${Math.max(1, Math.round(minutes))}m`;
  return `${Math.round(minutes / MINUTES_PER_HOUR)}h`;
}

/** The package booked most often (the first of a tie), for the "Most booked" badge; none until one is booked. */
export function mostBookedId(services: PublicService[]): string | null {
  const top = services.reduce<PublicService | null>((best, s) => (s.booking_count > (best?.booking_count ?? 0) ? s : best), null);
  return top?.id ?? null;
}

/** "Ayesha Mehendi Art" → ["Ayesha", "Mehendi Art"]: the storefront headline sets the rest in italics. */
export function splitName(name: string): [string, string] {
  const space = name.indexOf(' ');
  return space < 0 ? [name, ''] : [name.slice(0, space), name.slice(space + 1)];
}

export function packageCountLabel(count: number): string {
  return count === 1 ? '1 package' : `${count} packages`;
}
