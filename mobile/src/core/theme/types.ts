import type { TextStyle, ViewStyle } from 'react-native';
import type { radii } from './tokens/radii';
import type { spacing } from './tokens/spacing';
import type { typographyTokens } from './tokens/typography';

export type FontVariant = Required<Pick<TextStyle, 'fontFamily' | 'fontSize' | 'lineHeight' | 'letterSpacing'>>;
export type ShadowStyle = NonNullable<ViewStyle>;

export interface ThemeColors {
  background: string; surface: string;
  textPrimary: string; textSecondary: string; textMuted: string; textOnBrand: string;
  brand: string; brandPressed: string; brandSoft: string;
  brandSoftPressed: string; brandSoftBorder: string; // the secondary button's pressed fill and hairline
  disabledFill: string; disabledInk: string; // a disabled primary button: blush fill, rose label
  accent: string; separator: string;
  inputBackground: string; border: string; fieldEdge: string; borderFocus: string; // fieldEdge: the edge of a control you type into or toggle, held at 3:1 against the page. border stays for decorative hairlines
  error: string; errorOnSoft: string; errorBackground: string; success: string; // errorOnSoft: error text printed on errorBackground, which error does not clear
  overlay: string;
  brandOnImage: string; brandInk: string; imageFallback: string; // deeper cherries that stay legible over photos
  washTop: string; washBottom: string; // full-screen blush gradient (Choose role)
  photoScrim: string; // deep plum laid over photos so white text reads
  canvas: string; heading: string; // blush page + plum headline ink of the auth/onboarding screens
  skeletonBlock: string; // the loading placeholder itself — deep enough to see against a white page
  skeletonBand: string; // tint the placeholder band sweeps across a loading block
  progressTrack: string; // unfilled segment of the step bar
  indicatorInactive: string; // carousel dots that aren't the current slide
  roleCard: string; roleTag: string; // Choose role light card + its tag pill
  fieldHalo: string; // soft ring around a focused field
  brandSelection: string; // the caret/selection highlight inside a field: brand at 33%, spelled as a token so no one concatenates hex
  pendingSoft: string; pendingInk: string; pendingDot: string; // amber: awaiting the artist
  confirmedSoft: string; confirmedInk: string; // green: confirmed
  neutralSoft: string; // grey-pink pill for ended bookings
  sheen: string; // white gloss laid over brand fills and swept across the skeleton
  skeletonBandClear: string; // skeletonBand at 0 alpha: the soft edges of the shimmer band
  loaderHandle: string; loaderFerrule: string; loaderBristle: string; loaderStroke: string; // the makeup-brush loader on light surfaces
}

export interface Theme {
  name: 'light';
  colors: ThemeColors;
  typography: Record<keyof typeof typographyTokens, FontVariant>;
  spacing: Record<keyof typeof spacing, number>;
  radii: Record<keyof typeof radii, number>;
  shadows: { sm: ShadowStyle; md: ShadowStyle; lg: ShadowStyle };
}
