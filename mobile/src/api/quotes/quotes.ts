import { request } from '../../core/api/client';
import { withQuery } from '../../core/api/query-string';
import type {
  AcceptQuoteInput,
  AcceptQuoteResult,
  ArtistEnquiryScope,
  Enquiry,
  EnquiryInput,
  EnquiryPage,
  EnquirySummary,
  QuoteAvailability,
  QuoteInput,
} from '../../types/quotes/quotes';

const enquiryPath = (id: string) => `/enquiries/${encodeURIComponent(id)}`;
const artistEnquiryPath = (id: string) => `/artists/me/enquiries/${encodeURIComponent(id)}`;

// Customer: ask an artist for a quote, then accept it (a confirmed booking) or withdraw.
export function createEnquiry(body: EnquiryInput) {
  return request<Enquiry>('/enquiries', body, { auth: true });
}
export function listMyEnquiries(cursor?: string | null) {
  return request<EnquiryPage>(withQuery('/enquiries', { cursor }), undefined, { auth: true, method: 'GET' });
}
export function getEnquiry(id: string) {
  return request<Enquiry>(enquiryPath(id), undefined, { auth: true, method: 'GET' });
}
export function cancelEnquiry(id: string) {
  return request<Enquiry>(`${enquiryPath(id)}/cancel`, undefined, { auth: true });
}
/** Open starts for the quoted duration; 409 unless the enquiry is quoted. */
export function getQuoteAvailability(id: string, date: string) {
  return request<QuoteAvailability>(withQuery(`${enquiryPath(id)}/availability`, { date }), undefined, { auth: true, method: 'GET' });
}
export function acceptQuote(id: string, body: AcceptQuoteInput) {
  return request<AcceptQuoteResult>(`${enquiryPath(id)}/accept`, body, { auth: true });
}

// Artist (approved): answer enquiries with a quote, or decline.
export function listArtistEnquiries(status: ArtistEnquiryScope, cursor?: string | null) {
  return request<EnquiryPage>(withQuery('/artists/me/enquiries', { status, cursor }), undefined, { auth: true, method: 'GET' });
}
export function getArtistEnquiry(id: string) {
  return request<Enquiry>(artistEnquiryPath(id), undefined, { auth: true, method: 'GET' });
}
export function sendQuote(id: string, body: QuoteInput) {
  return request<Enquiry>(`${artistEnquiryPath(id)}/quote`, body, { auth: true });
}
export function declineEnquiry(id: string, reason: string | null) {
  return request<Enquiry>(`${artistEnquiryPath(id)}/decline`, { reason }, { auth: true });
}
export function getEnquirySummary() {
  return request<EnquirySummary>('/artists/me/enquiries/summary', undefined, { auth: true, method: 'GET' });
}
