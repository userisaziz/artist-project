import { z } from 'zod';
import { rupeesToPaise } from '../common/format';
import type { ShopSettings } from '../../types/shop/shop';

/** The two delivery amounts of a shop, as the artist typed them. */
export interface DeliveryDraft {
  fee: string;
  freeOver: string;
}

/**
 * What a shop charges for delivery and when it waives the charge.
 *
 * Both fields are optional in the artist's own way — an empty charge means free delivery, an empty
 * threshold means no free-delivery minimum — but text that is *meant* as money and isn't gets said back
 * to the artist. Before this rule existed, 'free for friends' in the charge field was read as ₹0 and
 * saved, so a typo could quietly give away delivery.
 */
export const deliveryDraftSchema = z
  .object({
    fee: z.string().transform((text, report) => {
      if (!text.trim()) return 0;
      const paise = rupeesToPaise(text);
      if (paise === null) {
        report.addIssue({ code: 'custom', message: 'Enter the charge in rupees, or leave it empty.' });
        return z.NEVER;
      }
      return paise;
    }),
    freeOver: z.string().transform((text, report) => {
      if (!text.trim()) return null;
      const paise = rupeesToPaise(text);
      if (paise === null) {
        report.addIssue({ code: 'custom', message: 'Enter the threshold in rupees, or leave it empty.' });
        return z.NEVER;
      }
      return paise;
    }),
  })
  .transform((delivery): Pick<ShopSettings, 'delivery_fee_paise' | 'free_delivery_over_paise'> => ({
    delivery_fee_paise: delivery.fee,
    free_delivery_over_paise: delivery.freeOver,
  }));
