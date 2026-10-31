import { z } from 'zod';
import { rupeesToPaise } from '../common/format';
import { MIN_QUOTE_PAISE } from './status';

/** The quote form's fields as the artist sets them: the price is still the text that was typed. */
export interface QuoteDraft {
  price: string;
  duration: number;
  note: string;
  validUntil: string;
}

/**
 * The artist's answer to an enquiry. Only the price can be wrong: the stepper and the day strip can
 * produce values inside their own bounds, so nothing else is checked here.
 *
 * The price rule and the rupees-to-paise parse are the same step, so the amount that is validated is
 * the amount that is sent — the form never parses the text a second time, and never has to decide what
 * to do with a parse that "can't" fail.
 */
export const quoteDraftSchema = z.object({
  price: z.string().transform((text, report) => {
    const paise = rupeesToPaise(text);
    if (!paise || paise < MIN_QUOTE_PAISE) {
      report.addIssue({ code: 'custom', message: 'Enter your price in rupees.' });
      return z.NEVER;
    }
    return paise;
  }),
  duration: z.number(),
  note: z.string(),
  validUntil: z.string(),
});

/** The fields after the schema has run: the price in paise, ready for the API. */
export type QuoteRequest = z.output<typeof quoteDraftSchema>;
