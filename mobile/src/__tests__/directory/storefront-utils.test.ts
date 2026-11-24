import { formatReplyTime, mostBookedId, packageCountLabel, servicePriceLabel, splitName, suggestServices } from '../../utils/directory/storefront';
import { countLabel } from '../../utils/catalog/units';
import type { PublicService } from '../../types/directory/directory';

const service = (id: string, booking_count: number): PublicService => ({
  id, name: id, description: null, price_paise: 100000, duration_minutes: 60, category: null, subcategory: null, booking_count, included_items: [], addons: [], photo_url: null, pricing_unit: 'package' as const, quantity_unit: null, min_quantity: 1, fulfilment: 'appointment' as const, details: [], booking_fields: [],
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

describe('units and suggestions', () => {
  const svc = (over: Partial<PublicService>): PublicService => ({ ...service('x', 0), ...over });

  it('labels per-unit and made-to-order prices with their unit', () => {
    const fmt = (p: number) => `₹${p / 100}`;
    expect(servicePriceLabel(svc({ price_paise: 35000, pricing_unit: 'per_unit', quantity_unit: 'box' }), fmt)).toBe('₹350 / box');
    expect(servicePriceLabel(svc({ price_paise: 250000, fulfilment: 'made_to_order', pricing_unit: 'per_unit', quantity_unit: 'piece' }), fmt)).toBe('From ₹2500 / piece');
    expect(servicePriceLabel(svc({ price_paise: 450000 }), fmt)).toBe('₹4500');
    expect(countLabel(1, 'person')).toBe('1 person');
    expect(countLabel(30, 'box')).toBe('30 boxes');
  });

  it('suggests the closest of the artist’s other services first, at most three', () => {
    const cat = (id: number) => ({ id, name: `c${id}` });
    const current = svc({ id: 'a', category: cat(1), subcategory: cat(10) });
    const all = [
      current,
      svc({ id: 'other-cat', category: cat(2), subcategory: cat(20) }),
      svc({ id: 'same-cat', category: cat(1), subcategory: cat(11) }),
      svc({ id: 'same-sub', category: cat(1), subcategory: cat(10) }),
      svc({ id: 'other-cat-2', category: cat(3), subcategory: cat(30) }),
    ];
    expect(suggestServices(all, current).map((s) => s.id)).toEqual(['same-sub', 'same-cat', 'other-cat']);
  });
});
