import { z } from 'zod';
import { MAX_PRICE_RUPEES } from '../common/format';
import type { ServicePricePatch } from '../../types/artist-services/artist-services';

export const MAX_MINUTES = 1440;

/** The two numbers a service sheet asks for, as the artist typed them. */
export interface PricingDraft {
  price: string;
  minutes: string;
}

/**
 * Price and duration for a service — the one rule set behind the three sheets that ask for them
 * (add a template service, set a price, offer a custom service).
 *
 * Each field checks the text and parses it in the same step, so the amount that is validated is the
 * amount that is sent, and the first message is the one the sheet used to show: price before duration.
 */
export const pricingDraftSchema = z
  .object({
    price: z.string().transform((text, report) => {
      const rupees = Number(text);
      if (!Number.isInteger(rupees) || rupees <= 0 || rupees > MAX_PRICE_RUPEES) {
        report.addIssue({ code: 'custom', message: 'Enter a price above ₹0.' });
        return z.NEVER;
      }
      return rupees * 100;
    }),
    minutes: z.string().transform((text, report) => {
      const mins = Number(text);
      if (!Number.isInteger(mins) || mins <= 0 || mins > MAX_MINUTES) {
        report.addIssue({ code: 'custom', message: `Enter a duration between 1 and ${MAX_MINUTES} minutes.` });
        return z.NEVER;
      }
      return mins;
    }),
  })
  .transform((priced): ServicePricePatch => ({ price_paise: priced.price, duration_minutes: priced.minutes }));
