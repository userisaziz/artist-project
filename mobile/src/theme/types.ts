import type { TextStyle, ViewStyle } from 'react-native';

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
  brandOnImage: string; brandInk: string; imageFallback: string; // deeper roses that stay legible over photos
  washTop: string; washBottom: string; // full-screen blush gradient (Choose role)
  photoScrim: string; // deep plum laid over photos so white text reads
}

export interface Theme {
  name: 'light';
  colors: ThemeColors;
  typography: { hero: FontVariant; eyebrow: FontVariant; display: FontVariant; accent: FontVariant; accentLight: FontVariant; title: FontVariant; subtitle: FontVariant; body: FontVariant; label: FontVariant; caption: FontVariant; button: FontVariant };
  spacing: { xs: number; sm: number; md: number; lg: number; xl: number; xxl: number };
  radii: { sm: number; md: number; card: number; pill: number };
  shadows: { sm: ShadowStyle; md: ShadowStyle; lg: ShadowStyle };
}
