import { quoteDraftSchema } from '../../utils/quotes/quote-draft';

const draft = (price: string) => ({ price, duration: 120, note: '', validUntil: '2026-11-09' });

it('sends the price as the paise it was checked as', () => {
  expect(quoteDraftSchema.parse(draft('12,500'))).toEqual({
    price: 1_250_000, duration: 120, note: '', validUntil: '2026-11-09',
  });
});

it('refuses anything that is not an amount worth quoting, with one sentence', () => {
  for (const price of ['', 'abc', '0', '0.50']) {
    expect(quoteDraftSchema.safeParse(draft(price)).error?.issues.map((i) => i.message)).toEqual(['Enter your price in rupees.']);
  }
});

it('leaves the controls it cannot get wrong alone', () => {
  expect(quoteDraftSchema.safeParse(draft('1500')).success).toBe(true);
});
