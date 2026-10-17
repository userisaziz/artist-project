import { DEFAULT_BLOCKED_WORDS, reviewFlag } from '../filter';

describe('reviewFlag: contact details', () => {
  it.each([
    'Call 98450 12345 to book directly',
    'my number is +91 98450-12345',
    '+919845012345',
    '9845012345',
    'ring 984-501-2345 anytime',
    'order id 123456789012 was paid',
    'ring (98450) 12345',
    '98450.12345',
    'US cell (555) 123-4567',
  ])('flags a phone number or a long digit run: %s', (text) => {
    expect(reviewFlag(text)).toBe('contact_info');
  });

  it.each([
    'write to priya.s@gmail.com for more',
    'follow @priya_mehendi for her work',
    'see https://example.com/portfolio',
    'her page is www.priyastudio.in',
    'HTTP://EXAMPLE.COM',
    'message me on wa.me/919845012345',
    'more at foo.com',
  ])('flags emails, handles and links: %s', (text) => {
    expect(reviewFlag(text)).toBe('contact_info');
  });
});

describe('reviewFlag: blocked words', () => {
  it.each(['What a SCAM', 'fraud!', 'Please call me back', 'WhatsApp me for discounts'])('flags a blocked phrase: %s', (text) => {
    expect(reviewFlag(text)).toBe('blocked_word');
  });

  it('matches whole phrases only', () => {
    expect(reviewFlag('scampi was served after the mehendi')).toBeNull();
    expect(reviewFlag('she can recall menus from memory')).toBeNull();
  });

  it('uses the list it is given', () => {
    expect(reviewFlag('this was rubbish', ['rubbish'])).toBe('blocked_word');
    expect(reviewFlag('what a scam', ['rubbish'])).toBeNull();
  });

  it('defaults to the backend list', () => {
    expect(DEFAULT_BLOCKED_WORDS).toEqual(['scam', 'fraud', 'call me', 'whatsapp me']);
  });

  it('contact details win over blocked words', () => {
    expect(reviewFlag('scam, call 9845012345')).toBe('contact_info');
  });
});

describe('reviewFlag: clean text', () => {
  it.each([
    'Paid ₹5,500 for bridal mehendi and it was worth it',
    'She arrived at 11 AM and finished by 3 PM',
    'Booked on 12/10/2026, 4 hours, 2 hands and 2 feet',
    'Rs 18,000 for HD bridal, 10/10 would book again',
    'Lovely work ❤️',
    'Booked 15-10-2026 11:00',
    'Paid on 12-10-2026 10 am',
    'Rs 1500 2000 3000 total',
    'It took 4.5 hours',
    '',
  ])('passes: %s', (text) => {
    expect(reviewFlag(text)).toBeNull();
  });
});
