import { z } from 'zod';
import { MAX_PRICE_RUPEES } from './format';
import type { ServiceAddon, ServiceExtrasInput } from '../../types/catalog/catalog';

export const MAX_INCLUDED_ITEMS = 8; // backend app.artist.constants
export const INCLUDED_ITEM_MAX_LENGTH = 60;
export const MAX_ADDONS = 10;
export const ADDON_NAME_MAX_LENGTH = 80;
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

/** What the two service sheets send for the extras part of a service. */
export type ExtrasInput = Required<Omit<ServiceExtrasInput, 'photo_key'>>;

/**
 * The extras editor's draft as the API wants it, or the first thing to fix.
 *
 * The same two rules serve "Add a service" and "Edit service": every add-on needs a name, and its price
 * has to be whole rupees within the catalogue ceiling. Blank included items are dropped rather than
 * refused — the artist added a row and changed their mind.
 */
export const extrasDraftSchema = z
  .object({
    included: z.array(z.string()),
    addons: z.array(z.object({ name: z.string(), price: z.string(), perPerson: z.boolean() })),
  })
  .transform((draft, report): ExtrasInput => {
    const included_items = draft.included.map((i) => i.trim()).filter(Boolean);
    const addons = [];
    for (const a of draft.addons) {
      const name = a.name.trim();
      if (!name) {
        report.addIssue({ code: 'custom', message: 'Give every add-on a name.' });
        return z.NEVER;
      }
      const rupees = Number(a.price);
      if (!Number.isInteger(rupees) || rupees <= 0 || rupees > MAX_PRICE_RUPEES) {
        report.addIssue({ code: 'custom', message: `Enter a price above ₹0 for “${name}”.` });
        return z.NEVER;
      }
      addons.push({ name, price_paise: rupees * PAISE_PER_RUPEE, per_person: a.perPerson });
    }
    return { included_items, addons };
  });

/** A saved service's extras, ready to edit. */
export function draftFromService(service: { included_items: string[]; addons: ServiceAddon[] }): ExtrasDraft {
  return {
    included: [...service.included_items],
    addons: service.addons.map((a) => ({ name: a.name, price: String(a.price_paise / PAISE_PER_RUPEE), perPerson: a.per_person })),
  };
}
