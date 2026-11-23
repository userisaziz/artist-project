import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../core/theme/theme-provider';

interface GlossSheenProps {
  /** Match the surface it sits on, so the sheen never pokes past a rounded corner. */
  radius: number;
  /** `glaze` is the white lacquer on a brand fill (buttons). `card` is for white surfaces, where white gloss
   *  is invisible: the top stays lit and a whisper of blush settles toward the bottom edge instead. */
  variant?: 'glaze' | 'card';
}

// The glaze covers the top of the surface and is gone by this point, like light caught on a lacquered edge.
const GLAZE_STOPS = [0, 0.58] as const;
const CARD_STOPS = [0.4, 1] as const;

/** A decorative gradient laid over a surface to make it read as glossy. It ignores touches and sits under
 *  the surface's content. The glaze fades to white-at-zero, never `transparent`, which iOS interpolates
 *  through black and leaves a grey band. */
export function GlossSheen({ radius, variant = 'glaze' }: GlossSheenProps) {
  const theme = useTheme();
  const glaze = variant === 'glaze';
  return (
    <LinearGradient
      pointerEvents="none"
      colors={glaze ? [theme.colors.sheen, theme.colors.sheenClear] : [theme.colors.surface, theme.colors.canvas]}
      locations={glaze ? GLAZE_STOPS : CARD_STOPS}
      style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
    />
  );
}
