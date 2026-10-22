import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../core/theme/theme-provider';

interface PhotoScrimProps {
  /** How far up from the photo's bottom edge the fade reaches. */
  height: number;
}

// The prototype's fade ends at its plum ink at 82% opacity.
const SCRIM_OPACITY = 0.82;
const CLEAR = 'transparent';

/** A fade from clear to the theme's photo scrim along the bottom of a photo, so white text laid over it reads. */
export function PhotoScrim({ height }: PhotoScrimProps) {
  const theme = useTheme();
  return (
    <LinearGradient
      colors={[CLEAR, theme.colors.photoScrim]}
      pointerEvents="none"
      style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height, opacity: SCRIM_OPACITY }}
    />
  );
}
