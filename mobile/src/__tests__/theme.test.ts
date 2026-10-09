import { lightTheme } from '../theme/themes/light';
import { palette } from '../theme/tokens/palette';

it('assigns every semantic color role', () => {
  const roles = Object.keys(lightTheme.colors);
  expect(roles.length).toBeGreaterThanOrEqual(18);
  for (const role of roles) expect(lightTheme.colors[role as keyof typeof lightTheme.colors]).toMatch(/^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/); // 8-digit = with alpha
});

it('maps brand to plum and background to blush (feminine identity)', () => {
  expect(lightTheme.colors.brand).toBe(palette.plum500);
  expect(lightTheme.colors.background).toBe(palette.blush100);
});

it('exposes all six typography roles with serif display and sans body', () => {
  expect(lightTheme.typography.display.fontFamily).toBe('PlayfairDisplay_700Bold');
  expect(lightTheme.typography.body.fontFamily).toBe('Inter_400Regular');
  expect(lightTheme.typography.caption.fontSize).toBeLessThan(lightTheme.typography.body.fontSize);
});
