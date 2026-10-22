import type { BookingAddonPick } from '../../types/bookings/bookings';
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
