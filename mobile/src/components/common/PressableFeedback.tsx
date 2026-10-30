import { useState } from 'react';
import { Platform, Pressable, type PressableProps, type PressableStateCallbackType } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { springs, useReducedMotion } from '../../core/motion/motion';
import { useTheme } from '../../core/theme/theme-provider';

const PRESSED_OPACITY = 0.6;
const PRESSED_SCALE = 0.97;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface PressableFeedbackProps extends PressableProps {
  /** Off for surfaces that aren't controls, e.g. a sheet's backdrop, so tapping it doesn't flash the screen. */
  feedback?: boolean;
  /** Adds the Premium press dip (scale 0.97, spring) on top of the dim/ripple. Off by default. */
  scale?: boolean;
}

/** Every tappable thing in the app: it answers the finger at once (a ripple on Android, a dim on iOS, an
 *  optional spring dip), so a tap never feels missed while the work behind it runs. Plain Pressable shows
 *  nothing on press. */
export function PressableFeedback({ feedback = true, scale = false, style, android_ripple, ...rest }: PressableFeedbackProps) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const responds = !rest.disabled && !!(rest.onPress || rest.onLongPress);
  const dims = feedback && responds;
  const dips = scale && responds && !reduced; // reduced motion keeps the dim/ripple, drops the dip
  const [pressed, setPressed] = useState(false);
  const dip = useSharedValue(1);
  const dipStyle = useAnimatedStyle(() => ({ transform: [{ scale: dip.value }] }));
  const ripple = dims && Platform.OS === 'android'
    ? android_ripple ?? { color: theme.colors.pressedOverlay, foreground: true }
    : android_ripple;
  const pressedStyle = (state: PressableStateCallbackType) => {
    const base = typeof style === 'function' ? style(state) : style;
    return dims && state.pressed && Platform.OS !== 'android' ? [base, { opacity: PRESSED_OPACITY }] : base;
  };
  if (!dips) {
    // Plain Pressable for the common case: identical feedback, no animated machinery.
    return <Pressable {...rest} android_ripple={ripple} style={pressedStyle} />;
  }
  // Reanimated only discovers animated styles that are direct elements of the style array — a
  // function-form style is never called during its scan, so the dip is resolved in JS instead.
  const userStyle = typeof style === 'function' ? style({ pressed }) : style;
  return (
    <AnimatedPressable
      {...rest}
      android_ripple={ripple}
      style={[userStyle, pressed && dims && Platform.OS !== 'android' ? { opacity: PRESSED_OPACITY } : null, dipStyle]}
      onPressIn={(e) => {
        setPressed(true);
        dip.set(withSpring(PRESSED_SCALE, springs.press));
        rest.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        setPressed(false);
        dip.set(withSpring(1, springs.press)); // unconditional reset: the dip can never stick
        rest.onPressOut?.(e);
      }}
    />
  );
}
