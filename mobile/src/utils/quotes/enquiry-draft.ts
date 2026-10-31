import { z } from 'zod';
import { rupeesToPaise } from '../common/format';
import { MIN_DETAILS } from './status';

/** The enquiry form's fields as the customer types them. An empty `eventDate` means no day is picked yet. */
export interface EnquiryDraft {
  eventDate: string;
  details: string;
  budget: string;
}

/**
 * What a quote request has to carry before it can be sent.
 *
 * Each rule carries the sentence the customer sees, and the checks are read in the order the form asks:
 * the day first, then the description, then the optional budget. `details` comes out trimmed, which is
 * exactly what the API receives, so the send path never trims again.
 */
export const enquiryDraftSchema = z.object({
  eventDate: z.string().min(1, 'Pick the date of your event.'),
  details: z.string().trim().min(MIN_DETAILS, `Tell the artist a little more (at least ${MIN_DETAILS} characters).`),
  budget: z.string(),
}).superRefine((draft, report) => {
  if (draft.budget.trim() && rupeesToPaise(draft.budget) === null) {
    report.addIssue({ code: 'custom', path: ['budget'], message: 'Enter the budget in rupees, or leave it empty.' });
  }
});
