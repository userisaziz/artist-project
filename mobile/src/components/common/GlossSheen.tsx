import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../core/theme/theme-provider';

interface GlossSheenProps {
  /** Match the surface it sits on, so the sheen never pokes past a rounded corner. */
  radius: number;
  /** `glaze` is the lacquer on a brand or plum fill (buttons, selected chips). `card` is for white surfaces,
   *  where white gloss is invisible: the top stays lit and a blush settles toward the bottom edge instead. */
  variant?: 'glaze' | 'card';
}

// Lacquer: bright at the top, easing to a faint film, then a soft horizon just past the middle where the
// reflection ends, the way light sits on a glazed pill. The horizon is what reads as "shiny" rather than
// "lighter at the top".
const GLAZE_STOPS = [0, 0.4, 0.52] as const;
const CARD_STOPS = [0.35, 1] as const;

/** A decorative gradient laid over a surface to make it read as glossy. It ignores touches and sits under
 *  the surface's content. Every fade ends in white-at-zero, never `transparent`, which iOS interpolates
 *  through black and leaves a grey band. */
export function GlossSheen({ radius, variant = 'glaze' }: GlossSheenProps) {
  const theme = useTheme();
  if (variant === 'card') {
    return (
      <LinearGradient
        pointerEvents="none"
        colors={[theme.colors.surface, theme.colors.washBottom]}
        locations={CARD_STOPS}
        style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
      />
    );
  }
  return (
    <>
      <LinearGradient
        pointerEvents="none"
        colors={[theme.colors.sheen, theme.colors.sheenMid, theme.colors.sheenClear]}
        locations={GLAZE_STOPS}
        style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
      />
      {/* The rim: a bright hairline along the top edge only, catching the light like a lacquered lip. */}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: radius, borderWidth: 1,
            borderTopColor: theme.colors.sheenRim,
            borderLeftColor: theme.colors.sheenClear, borderRightColor: theme.colors.sheenClear, borderBottomColor: theme.colors.sheenClear,
          },
        ]}
      />
    </>
  );
}
