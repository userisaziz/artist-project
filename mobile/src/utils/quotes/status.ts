import type { PillTone } from '../../components/common/StatusPill';
import type { Enquiry, EnquiryStatus } from '../../types/quotes/quotes';

export const MIN_DETAILS = 10; // backend EnquiryIn.details
export const MAX_DETAILS = 1000;
export const MAX_NOTE = 500; // backend QuoteIn.note / AcceptIn.note
export const MAX_ADDRESS = 300;
export const MIN_QUOTE_PAISE = 100;
export const DURATION_STEP = 30; // minutes; backend QuoteIn.duration_minutes
export const MIN_DURATION = 30;
export const MAX_DURATION = 720;
export const DEFAULT_DURATION = 120;
/** How far ahead a customer can ask about an event. */
export const EVENT_WINDOW_DAYS = 60;

type Pill = { label: string; tone: PillTone };

/** How each status reads to the customer who asked. */
export const CUSTOMER_ENQUIRY_PILL: Record<EnquiryStatus, Pill> = {
  open: { label: 'Awaiting quote', tone: 'pending' },
  quoted: { label: 'Quote ready', tone: 'brand' },
  accepted: { label: 'Booked', tone: 'confirmed' },
  declined: { label: 'Declined', tone: 'neutral' },
  cancelled: { label: 'Withdrawn', tone: 'neutral' },
  expired: { label: 'Expired', tone: 'neutral' },
};

/** How each status reads to the artist who answers. */
export const ARTIST_ENQUIRY_PILL: Record<EnquiryStatus, Pill> = {
  open: { label: 'New', tone: 'pending' },
  quoted: { label: 'Quoted', tone: 'brand' },
  accepted: { label: 'Booked', tone: 'confirmed' },
  declined: { label: 'Declined', tone: 'neutral' },
  cancelled: { label: 'Withdrawn', tone: 'neutral' },
  expired: { label: 'Expired', tone: 'neutral' },
};

/** 'Priya S.': the customer's first name and last initial, or 'Customer'. */
export function customerShortName(c: Enquiry['customer']): string {
  const initial = c.last_name?.trim().charAt(0);
  const first = c.first_name?.trim();
  if (!first) return initial ? `${initial}.` : 'Customer';
  return initial ? `${first} ${initial}.` : first;
}

/** The customer can still withdraw while the artist hasn't answered, or hasn't been taken up on, the quote. */
export const canWithdraw = (e: Enquiry) => e.status === 'open' || e.status === 'quoted';

/** The artist can quote (or re-quote) until the enquiry closes. */
export const canQuote = (e: Enquiry) => e.status === 'open' || e.status === 'quoted';
