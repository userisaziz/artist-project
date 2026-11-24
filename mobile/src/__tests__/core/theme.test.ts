import { lightTheme } from '../../core/theme/themes/light';
import { palette } from '../../core/theme/tokens/palette';

it('assigns every semantic color role', () => {
  const roles = Object.keys(lightTheme.colors);
  expect(roles.length).toBeGreaterThanOrEqual(18);
  for (const role of roles) expect(lightTheme.colors[role as keyof typeof lightTheme.colors]).toMatch(/^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/); // 8-digit = with alpha
});

it('maps brand to cherry and text to plum-brown ink (Cherry Red kit)', () => {
  expect(lightTheme.colors.brand).toBe(palette.cherry500);
  expect(lightTheme.colors.brand).toBe('#D92D55'); // Cherry Red kit
  expect(lightTheme.colors.textPrimary).toBe(palette.ink900);
  expect(lightTheme.colors.brandPressed).toBe(palette.cherry600);
  expect(lightTheme.colors.brandSoft).toBe(palette.cherry100);
});

it('has an italic accent face for emphasised words', () => {
  expect(lightTheme.typography.accent.fontFamily).toBe('PlusJakartaSans_600SemiBold_Italic');
  expect(lightTheme.typography.hero.fontSize).toBeGreaterThan(lightTheme.typography.display.fontSize);
});

it('exposes all six typography roles with Jakarta headings and body', () => {
  expect(lightTheme.typography.display.fontFamily).toBe('PlusJakartaSans_600SemiBold');
  expect(lightTheme.typography.body.fontFamily).toBe('PlusJakartaSans_400Regular');
  expect(lightTheme.typography.caption.fontSize).toBeLessThan(lightTheme.typography.body.fontSize);
});
