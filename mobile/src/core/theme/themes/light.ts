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
    // Cherry Red kit: cherry 500 fills, cherry 600 when pressed, cherry 100 tint behind secondary actions.
    brand: palette.cherry500,
    brandPressed: palette.cherry600,
    brandSoft: palette.cherry100,
    brandSoftPressed: palette.blush300,
    brandSoftBorder: palette.blush250,
    disabledFill: palette.blush150,
    disabledInk: palette.rose400,
    accent: palette.rose400,
    separator: palette.line100,
    inputBackground: palette.white,
    border: palette.line200,
    borderFocus: palette.cherry500,
    error: palette.error500,
    errorBackground: palette.error100,
    success: palette.sage600,
    overlay: palette.scrim,
    brandOnImage: palette.cherry600,
    brandInk: palette.cherry700,
    imageFallback: palette.blush400,
    washTop: palette.blush75,
    washBottom: palette.blush100,
    photoScrim: palette.plum950,
    canvas: palette.blush60,
    skeletonBlock: palette.blush250, // not canvas: a placeholder has to survive on a white page, where 3% off white is invisible
    skeletonBand: palette.blush300, // deeper than the block, so the sweep reads as motion rather than a flicker
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
    sheen: palette.sheen,
    sheenMid: palette.sheenMid,
    sheenRim: palette.sheenRim,
    sheenClear: palette.sheenClear,
    skeletonBandClear: palette.blush300Clear,
    loaderHandle: palette.plum900,
    loaderFerrule: palette.ink300,
    loaderBristle: palette.cherry500,
    loaderStroke: palette.blush300,
  },
  typography: typographyTokens,
  spacing,
  radii,
  shadows,
};
