import { pricingDraftSchema } from '../../utils/artist-services/service-pricing';

const parse = (price: string, minutes: string) => pricingDraftSchema.safeParse({ price, minutes });
const message = (price: string, minutes: string) => parse(price, minutes).error?.issues[0].message;

it('sends the numbers it checked, as paise and minutes', () => {
  expect(parse('6000', '150')).toEqual({ success: true, data: { price_paise: 600_000, duration_minutes: 150 } });
});

it('refuses a price that is not a whole number of rupees the artist can charge', () => {
  expect(message('', '60')).toBe('Enter a price above ₹0.');
  expect(message('0', '60')).toBe('Enter a price above ₹0.');
  expect(message('12.5', '60')).toBe('Enter a price above ₹0.');
  expect(message('one', '60')).toBe('Enter a price above ₹0.');
  expect(message('1000001', '60')).toBe('Enter a price above ₹0.');
});

it('refuses a duration outside a working day', () => {
  expect(message('2500', '0')).toBe('Enter a duration between 1 and 1440 minutes.');
  expect(message('2500', '90.5')).toBe('Enter a duration between 1 and 1440 minutes.');
  expect(message('2500', '1441')).toBe('Enter a duration between 1 and 1440 minutes.');
  expect(message('2500', '1440')).toBeUndefined();
});

it('names the price before the duration, the order the fields are asked in', () => {
  expect(message('0', '0')).toBe('Enter a price above ₹0.');
});
