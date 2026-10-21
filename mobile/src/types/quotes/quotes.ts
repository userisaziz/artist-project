import type { Page } from '../../core/api/types';

export type EnquiryStatus = 'open' | 'quoted' | 'accepted' | 'declined' | 'cancelled' | 'expired';

/** The artist's enquiry tabs (GET /artists/me/enquiries?status=). */
export type ArtistEnquiryScope = 'open' | 'quoted' | 'closed';

export interface EnquiryQuote {
  price_paise: number;
  duration_minutes: number;
  note: string | null;
  /** IST date ('YYYY-MM-DD'), the last day the customer can accept. */
  valid_until: string;
  quoted_at: string;
}

/** EnquiryOut: a customer's request for a custom quote, and the artist's answer. */
export interface Enquiry {
  id: string;
  status: EnquiryStatus;
  /** IST date ('YYYY-MM-DD'). */
  event_date: string;
  details: string;
  budget_paise: number | null;
  created_at: string;
  artist: { id: string; business_name: string; photo_url: string | null; city: string };
  customer: { first_name: string | null; last_name: string | null };
  quote: EnquiryQuote | null;
  decline_reason: string | null;
  booking_id: string | null;
}

export type EnquiryPage = Page<Enquiry>;

export interface EnquiryInput {
  artist_id: string;
  event_date: string;
  details: string;
  budget_paise: number | null;
}

export interface AcceptQuoteInput {
  start_at: string;
  address: string;
  note?: string | null;
}

export interface AcceptQuoteResult {
  enquiry: Enquiry;
  booking_id: string;
}

export interface QuoteInput {
  price_paise: number;
  duration_minutes: number;
  note: string | null;
  valid_until: string;
}

/** GET /enquiries/{id}/availability: the artist's open starts for the quoted duration on one date. */
export interface QuoteAvailability {
  date: string;
  slots: { start_at: string; available: boolean }[];
}

export interface EnquirySummary {
  open: number;
  quoted: number;
}
