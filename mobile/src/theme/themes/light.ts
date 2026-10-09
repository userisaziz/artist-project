import { palette } from '../tokens/palette';
import { typographyTokens } from '../tokens/typography';
import { spacing } from '../tokens/spacing';
import { radii } from '../tokens/radii';
import { shadows } from '../tokens/shadows';
import type { Theme } from '../types';

export const lightTheme: Theme = {
  name: 'light',
  colors: {
    background: palette.white,
    surface: palette.white,
    textPrimary: palette.ink900,
    textSecondary: palette.ink700,
    textMuted: palette.ink500,
    textOnBrand: palette.white,
    brand: palette.rose500,
    brandPressed: palette.rose700,
    brandSoft: palette.blush200,
    accent: palette.rose400,
    separator: palette.line100,
    inputBackground: palette.white,
    border: palette.line300,
    borderFocus: palette.rose400,
    error: palette.error500,
    errorBackground: palette.error100,
    success: palette.sage600,
    overlay: palette.scrim,
    brandOnImage: palette.rose600,
    brandInk: palette.rose800,
    imageFallback: palette.blush400,
  },
  typography: typographyTokens,
  spacing,
  radii,
  shadows,
};
