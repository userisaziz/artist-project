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
    border: palette.line200,
    borderFocus: palette.rose500,
    error: palette.error500,
    errorBackground: palette.error100,
    success: palette.sage600,
    overlay: palette.scrim,
    brandOnImage: palette.rose600,
    brandInk: palette.rose800,
    imageFallback: palette.blush400,
    washTop: palette.blush75,
    washBottom: palette.blush100,
    photoScrim: palette.plum950,
    canvas: palette.blush60,
    heading: palette.plum900,
    progressTrack: palette.blush280,
    indicatorInactive: palette.blush300,
    roleCard: palette.blush150,
    roleTag: palette.blush250,
    fieldHalo: palette.blush100,
    pendingSoft: palette.amber100,
    pendingInk: palette.amber700,
    pendingDot: palette.amber500,
    confirmedSoft: palette.sage100,
    confirmedInk: palette.sage600,
    neutralSoft: palette.mist100,
  },
  typography: typographyTokens,
  spacing,
  radii,
  shadows,
};
