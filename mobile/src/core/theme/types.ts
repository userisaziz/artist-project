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
  accent: string; separator: string;
  inputBackground: string; border: string; borderFocus: string;
  error: string; errorBackground: string; success: string;
  overlay: string;
  pressedOverlay: string; // the ripple / tint a control shows under the finger
  brandOnImage: string; brandInk: string; imageFallback: string; // deeper roses that stay legible over photos
  washTop: string; washBottom: string; // full-screen blush gradient (Choose role)
  photoScrim: string; // deep plum laid over photos so white text reads
  canvas: string; heading: string; // blush page + plum headline ink of the auth/onboarding screens
  skeletonBand: string; // tint the placeholder band sweeps across a loading block
  progressTrack: string; // unfilled segment of the step bar
  indicatorInactive: string; // carousel dots that aren't the current slide
  roleCard: string; roleTag: string; // Choose role light card + its tag pill
  fieldHalo: string; // soft ring around a focused field
  pendingSoft: string; pendingInk: string; pendingDot: string; // amber: awaiting the artist
  confirmedSoft: string; confirmedInk: string; // green: confirmed
  neutralSoft: string; // grey-pink pill for ended bookings
}

export interface Theme {
  name: 'light';
  colors: ThemeColors;
  typography: Record<keyof typeof typographyTokens, FontVariant>;
  spacing: Record<keyof typeof spacing, number>;
  radii: Record<keyof typeof radii, number>;
  shadows: { sm: ShadowStyle; md: ShadowStyle; lg: ShadowStyle };
}
