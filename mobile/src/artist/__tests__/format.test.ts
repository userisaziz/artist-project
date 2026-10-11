import { formatDuration, formatPrice } from '../format';

it('formats paise as whole rupees with Indian grouping', () => {
  expect(formatPrice(450000)).toBe('₹4,500');
  expect(formatPrice(12500000)).toBe('₹1,25,000');
});

it('formats durations in minutes and hours', () => {
  expect(formatDuration(45)).toBe('45 min');
  expect(formatDuration(180)).toBe('3 hr');
  expect(formatDuration(90)).toBe('1 hr 30 min');
});
