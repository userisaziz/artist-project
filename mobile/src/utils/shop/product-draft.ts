import { z } from 'zod';
import { rupeesToPaise } from '../common/format';

/** The four product fields exactly as the two product forms hold them: raw text, one parse. */
export interface ProductDraft {
  name: string;
  price: string;
  mrp: string;
  stock: string;
}

/**
 * What a listing's name, price, MRP and stock have to satisfy before Publish or Save unlocks.
 *
 * Every rule is declared with the message the artist sees, and the issues come out in the order the form
 * asks for them — name, then price, then the MRP comparison, then stock — so the hint under the fields
 * always names the first thing still missing.
 */
export const productDraftSchema = z.object({
  name: z.string(),
  price: z.string(),
  mrp: z.string(),
  stock: z.string(),
}).superRefine((draft, report) => {
  const pricePaise = rupeesToPaise(draft.price);
  const mrpPaise = draft.mrp.trim() ? rupeesToPaise(draft.mrp) : null;
  const stock = Number(draft.stock);
  if (draft.name.trim().length < 2) {
    report.addIssue({ code: 'custom', path: ['name'], message: 'Add a name' });
    return;
  }
  if (!pricePaise) {
    report.addIssue({ code: 'custom', path: ['price'], message: 'Add a price' });
    return;
  }
  if (draft.mrp.trim() && (mrpPaise === null || mrpPaise < pricePaise)) {
    report.addIssue({ code: 'custom', path: ['mrp'], message: 'The MRP can’t be below the price' });
    return;
  }
  if (!draft.stock.trim() || !Number.isInteger(stock) || stock < 0) {
    report.addIssue({ code: 'custom', path: ['stock'], message: 'Stock is a whole number' });
  }
});
