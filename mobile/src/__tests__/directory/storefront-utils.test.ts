import { formatReplyTime, mostBookedId, packageCountLabel, splitName } from '../../utils/directory/storefront';
import type { PublicService } from '../../types/directory/directory';

const service = (id: string, booking_count: number): PublicService => ({
  id, name: id, description: null, price_paise: 100000, duration_minutes: 60, category: null, subcategory: null, booking_count, included_items: [], addons: [],
});

it('shows reply time in minutes under an hour, then in hours', () => {
  expect(formatReplyTime(0)).toBe('1m');
  expect(formatReplyTime(10)).toBe('10m');
  expect(formatReplyTime(59)).toBe('59m');
  expect(formatReplyTime(150)).toBe('3h');
});

it('marks the most booked package, and none before anything is booked', () => {
  expect(mostBookedId([service('a', 2), service('b', 5), service('c', 5)])).toBe('b');
  expect(mostBookedId([service('a', 0), service('b', 0)])).toBeNull();
  expect(mostBookedId([])).toBeNull();
});

it('sets everything after the first word of the name in italics', () => {
  expect(splitName('Ayesha Mehendi Art')).toEqual(['Ayesha', 'Mehendi Art']);
  expect(splitName('Meher')).toEqual(['Meher', '']);
});

it('counts packages', () => {
  expect(packageCountLabel(1)).toBe('1 package');
  expect(packageCountLabel(4)).toBe('4 packages');
});
