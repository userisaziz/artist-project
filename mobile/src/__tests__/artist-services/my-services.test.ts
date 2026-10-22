import { CUSTOM_STATUS_PILL, groupMyServices, groupTitle } from '../../utils/artist-services/my-services';
import type { ServiceItem } from '../../types/artist-onboarding/artist-onboarding';
import type { CatalogCategory } from '../../types/catalog/catalog';

const tree: CatalogCategory[] = [
  { id: 1, slug: 'mehendi', name: 'Mehendi', subcategories: [{ id: 101, slug: 'mehendi-bridal', name: 'Bridal', services: [] }, { id: 102, slug: 'mehendi-arabic', name: 'Arabic', services: [] }] },
];
const svc = (id: string, subcategory_id: number): ServiceItem => ({
  id, category_id: subcategory_id, subcategory_id, template_id: null, name: id, price_paise: 100, duration_minutes: 60,
  description: null, status: 'pending', rejection_reason: null, included_items: [], addons: [],
});

it('titles a group "Category › Subcategory", a top-level category alone, or "Other"', () => {
  expect(groupTitle(tree, 102)).toBe('Mehendi › Arabic');
  expect(groupTitle(tree, 1)).toBe('Mehendi');
  expect(groupTitle(tree, 999)).toBe('Other');
});

it('groups services in menu order', () => {
  const groups = groupMyServices(tree, [svc('a', 101), svc('b', 102), svc('c', 101)]);
  expect(groups.map(([title, items]) => [title, items.map((s) => s.id)])).toEqual([['Mehendi › Bridal', ['a', 'c']], ['Mehendi › Arabic', ['b']]]);
});

it('labels custom services Live, In review or Not approved', () => {
  expect([CUSTOM_STATUS_PILL.approved.label, CUSTOM_STATUS_PILL.pending.label, CUSTOM_STATUS_PILL.rejected.label]).toEqual(['Live', 'In review', 'Not approved']);
});

it('groups a service waiting on its own suggestion under "Parent › Suggestion (suggested)"', () => {
  const waiting: ServiceItem = { ...svc('d', 1), suggested_subcategory: { id: 'r1', name: 'Couple portrait', status: 'pending' } };
  const decided: ServiceItem = { ...svc('e', 101), suggested_subcategory: { id: 'r2', name: 'Bridal', status: 'approved' } };
  expect(groupMyServices(tree, [waiting, decided]).map(([title]) => title)).toEqual(['Mehendi › Couple portrait (suggested)', 'Mehendi › Bridal']);
});
