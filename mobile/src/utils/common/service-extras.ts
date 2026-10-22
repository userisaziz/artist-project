import type { ServiceAddon, ServiceExtrasInput } from '../../types/catalog/catalog';

export const MAX_INCLUDED_ITEMS = 8; // backend app.artist.constants
export const INCLUDED_ITEM_MAX_LENGTH = 60;
export const MAX_ADDONS = 10;
export const ADDON_NAME_MAX_LENGTH = 80;
const MAX_ADDON_RUPEES = 1_000_000; // backend MAX_PRICE_PAISE / 100
const PAISE_PER_RUPEE = 100;

/** One add-on as typed in the editor: the price is the rupee text from the field. */
export interface AddonDraft {
  name: string;
  price: string;
  perPerson: boolean;
}

export interface ExtrasDraft {
  included: string[];
  addons: AddonDraft[];
}

export const EMPTY_EXTRAS: ExtrasDraft = { included: [], addons: [] };

export type ExtrasResult = { ok: true; value: Required<ServiceExtrasInput> } | { ok: false; error: string };

/** The editor's draft as the API wants it, or the first thing to fix. */
export function extrasInput(draft: ExtrasDraft): ExtrasResult {
  const included = draft.included.map((i) => i.trim()).filter(Boolean);
  const addons = [];
  for (const a of draft.addons) {
    const name = a.name.trim();
    if (!name) return { ok: false, error: 'Give every add-on a name.' };
    const rupees = Number(a.price);
    if (!Number.isInteger(rupees) || rupees <= 0 || rupees > MAX_ADDON_RUPEES) {
      return { ok: false, error: `Enter a price above ₹0 for “${name}”.` };
    }
    addons.push({ name, price_paise: rupees * PAISE_PER_RUPEE, per_person: a.perPerson });
  }
  return { ok: true, value: { included_items: included, addons } };
}

/** A saved service's extras, ready to edit. */
export function draftFromService(service: { included_items: string[]; addons: ServiceAddon[] }): ExtrasDraft {
  return {
    included: [...service.included_items],
    addons: service.addons.map((a) => ({ name: a.name, price: String(a.price_paise / PAISE_PER_RUPEE), perPerson: a.per_person })),
  };
}
