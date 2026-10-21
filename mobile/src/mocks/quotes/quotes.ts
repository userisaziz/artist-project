import type { Enquiry, EnquiryQuote } from '../../types/quotes/quotes';

// Mirrors backend EnquiryOut.
export function quoteFixture(overrides: Partial<EnquiryQuote> = {}): EnquiryQuote {
  return {
    price_paise: 1_250_000,
    duration_minutes: 240,
    note: 'Includes a trial session',
    valid_until: '2030-11-20',
    quoted_at: '2030-11-01T06:00:00Z',
    ...overrides,
  };
}

export function enquiryFixture(overrides: Partial<Enquiry> = {}): Enquiry {
  return {
    id: 'e-1',
    status: 'open',
    event_date: '2030-11-25',
    details: 'Bridal mehendi for the bride and four bridesmaids',
    budget_paise: 1_000_000,
    created_at: '2030-11-01T05:00:00Z',
    artist: { id: 'a1', business_name: 'Ayesha Mehendi Art', photo_url: null, city: 'Bangalore' },
    customer: { first_name: 'Priya', last_name: 'Sharma' },
    quote: null,
    decline_reason: null,
    booking_id: null,
    ...overrides,
  };
}
