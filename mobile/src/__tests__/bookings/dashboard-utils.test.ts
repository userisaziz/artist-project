import { attentionItems, monthChange, shortMonth } from '../../utils/bookings/dashboard';

it('labels the month-on-month change', () => {
  expect(monthChange(12000, 10000)).toEqual({ trend: 'up', label: '+20% vs last month' });
  expect(monthChange(5000, 10000)).toEqual({ trend: 'down', label: '-50% vs last month' });
  expect(monthChange(10000, 10000)).toEqual({ trend: 'flat', label: 'Same as last month' });
  expect(monthChange(0, 0)).toEqual({ trend: 'flat', label: 'No earnings yet this month' });
  expect(monthChange(500, 0).trend).toBe('up');
});

it('short-names a month', () => {
  expect(shortMonth('2026-01')).toBe('Jan');
  expect(shortMonth('2026-12')).toBe('Dec');
});

it('orders attention items urgent first and drops the empty ones', () => {
  const base = { requests_expiring_soon: 0, reschedules_pending: 2, enquiries_open: 1 };
  const items = attentionItems(base as Parameters<typeof attentionItems>[0]);
  expect(items.map((i) => i.key)).toEqual(['reschedules', 'enquiries']);
  expect(items[0].title).toBe('2 clients want a new time');
});
