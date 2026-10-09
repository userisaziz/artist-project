import { palette } from '../tokens/palette';
import { typographyTokens } from '../tokens/typography';
import { spacing } from '../tokens/spacing';
import { radii } from '../tokens/radii';
import { shadows } from '../tokens/shadows';
import type { Theme } from '../types';

export const lightTheme: Theme = {
  name: 'light',
  colors: {
    background: palette.blush100,
    surface: palette.cream,
    textPrimary: palette.ink900,
    textSecondary: palette.ink600,
    textMuted: palette.ink400,
    textOnBrand: palette.white,
    brand: palette.plum500,
    brandPressed: palette.plum700,
    brandSoft: palette.blush300,
    accent: palette.terra500,
    separator: palette.blush500,
    inputBackground: palette.cream,
    border: palette.blush500,
    borderFocus: palette.rose500,
    error: palette.error500,
    errorBackground: palette.error100,
    success: palette.sage500,
  },
  typography: typographyTokens,
  spacing,
  radii,
  shadows,
};
