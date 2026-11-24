import type { BookingAddonPick } from '../../types/bookings/bookings';
import { MAX_QUANTITY } from '../catalog/units';
import type { ServiceAddon } from '../../types/catalog/catalog';

export const MAX_ADDON_GUESTS = 50; // backend app.booking.constants.MAX_ADDON_GUESTS

export interface AddonLine {
  addon: ServiceAddon;
  guests: number;
  line_paise: number;
}

/** Picks as a route param, "id:guests,id:guests" (route params are strings). */
export function encodeAddonPicks(picks: BookingAddonPick[]): string {
  return picks.map((p) => `${p.addon_id}:${p.guests}`).join(',');
}

/** The route param back as picks, keeping only add-ons the service offers, each once, with a sane guest count. */
export function decodeAddonPicks(raw: string | undefined, offered: ServiceAddon[]): BookingAddonPick[] {
  const byId = new Map(offered.map((a) => [a.id, a]));
  const picks: BookingAddonPick[] = [];
  for (const part of (raw ?? '').split(',')) {
    const [id, count] = part.split(':');
    const addon = id ? byId.get(id) : undefined;
    const guests = Number(count);
    if (!addon || picks.some((p) => p.addon_id === id)) continue;
    if (!Number.isInteger(guests) || guests < 1 || guests > MAX_ADDON_GUESTS) continue;
    picks.push({ addon_id: addon.id, guests: addon.per_person ? guests : 1 });
  }
  return picks;
}

/** Each pick priced like the server does: unit price × guests (1 for flat add-ons). */
export function addonLines(offered: ServiceAddon[], picks: BookingAddonPick[]): AddonLine[] {
  return picks.flatMap((p) => {
    const addon = offered.find((a) => a.id === p.addon_id);
    return addon ? [{ addon, guests: p.guests, line_paise: addon.price_paise * p.guests }] : [];
  });
}

export function addonsTotal(lines: AddonLine[]): number {
  return lines.reduce((sum, l) => sum + l.line_paise, 0);
}

/** "2 add-ons" / "1 add-on" / '' — the cart-style count shown next to a running total. */
export function addonCountLabel(count: number): string {
  if (!count) return '';
  return `${count} ${count === 1 ? 'add-on' : 'add-ons'}`;
}

/** "Guest mehendi × 4 guests" for per-person add-ons; the plain name otherwise. */
export function addonLineLabel(line: { name: string; per_person: boolean; guests: number }): string {
  return line.per_person ? `${line.name} × ${line.guests} ${line.guests === 1 ? 'guest' : 'guests'}` : line.name;
}

/** Drop one pick, as a cart's remove does. */
export function removePick(picks: BookingAddonPick[], addonId: string): BookingAddonPick[] {
  return picks.filter((p) => p.addon_id !== addonId);
}

/** A per-unit quantity from a route param: a whole number from the service's minimum up to MAX_QUANTITY, else
 *  the minimum. */
export function parseQuantity(raw: string | undefined, min: number): number {
  const n = Number(raw);
  return Number.isInteger(n) && n >= min && n <= MAX_QUANTITY ? n : min;
}
