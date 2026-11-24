import { tabBadge } from '../../utils/common/badge';

it('hides an empty badge and caps a big one', () => {
  expect(tabBadge(0)).toBeUndefined();
  expect(tabBadge(3)).toBe('3');
  expect(tabBadge(140)).toBe('99+');
});
