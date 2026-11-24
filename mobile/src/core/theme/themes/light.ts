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
    textMuted: palette.ink550, // ink500 cleared 4.5:1 on white alone and failed on all ten tinted surfaces; this is the lightest ink that holds on every one
    textOnBrand: palette.white,
    // Cherry Red kit: cherry 500 fills, cherry 600 when pressed, cherry 100 tint behind secondary actions.
    brand: palette.cherry500,
    brandPressed: palette.cherry600,
    brandSoft: palette.cherry100,
    brandSoftPressed: palette.blush250, // blush300 put the label at 4.43:1 for the whole press; this keeps a visible step and holds 5.29
    brandSoftBorder: palette.fieldEdge, // blush250 measured 1.41:1 on the page and 1.15:1 on its own fill: the tinted button had no visible boundary
    disabledFill: palette.blush150,
    disabledInk: palette.rose500, // rose400 measured 2.91:1 on the disabled fill
    accent: palette.rose400,
    separator: palette.line100,
    inputBackground: palette.white,
    border: palette.line200,
    fieldEdge: palette.fieldEdge, // the resting edge of a control you type into, toggle or tap: line200 measured 1.43:1 on white
    borderFocus: palette.cherry500,
    error: palette.error500,
    errorOnSoft: palette.error600, // error500 measured 3.92:1 on errorBackground
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
    brandSelection: palette.cherry500Selection, // the same value the fields used to build by hand as `${brand}55`
    pendingSoft: palette.amber100,
    pendingInk: palette.amber800, // amber700 measured 4.40:1 on pendingSoft; amber700 stays as admin's --warning
    pendingDot: palette.amber500,
    confirmedSoft: palette.sage100,
    confirmedInk: palette.sage600,
    neutralSoft: palette.mist100,
    sheen: palette.sheen,
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
