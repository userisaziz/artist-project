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

/** "Book" goes through Service detail first when there's something to pick or learn there: add-ons, a guest count,
 *  questions for the customer, or a made-to-order service (quoted, not booked). */
export function needsServicePage(s: Pick<PublicService, 'addons' | 'pricing_unit' | 'booking_fields' | 'fulfilment'>): boolean {
  return s.addons.length > 0 || s.pricing_unit === 'per_person' || s.booking_fields.length > 0 || s.fulfilment === 'made_to_order';
}

/** The price as a package row shows it: "₹800 / person", "From ₹12,000" (made to order) or "₹4,500". */
export function servicePriceLabel(s: Pick<PublicService, 'price_paise' | 'pricing_unit' | 'fulfilment'>, format: (paise: number) => string): string {
  if (s.fulfilment === 'made_to_order') return `From ${format(s.price_paise)}`;
  return s.pricing_unit === 'per_person' ? `${format(s.price_paise)} / person` : format(s.price_paise);
}
