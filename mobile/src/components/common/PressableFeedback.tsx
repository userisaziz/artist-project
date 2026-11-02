import { useRef, useState } from 'react';
import { Pressable, type LayoutChangeEvent, type PressableProps, type PressableStateCallbackType } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { haptic, type HapticKind } from '../../core/motion/haptics';
import { springs, useReducedMotion } from '../../core/motion/motion';

const PRESSED_OPACITY = 0.85;
/** How far, in points, an edge travels inward while held. A fixed travel keeps the dip reading the same
 *  on a chip and on a full-width card: a flat percentage barely moves a chip and lurches a card. */
const PRESSED_TRAVEL = 4;
/** Bounds on the derived scale: the deepest a small control dips, and the least a huge surface does. */
const PRESSED_SCALE_MIN = 0.96;
const PRESSED_SCALE_MAX = 0.985;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Scale that moves the element's longer edge inward by PRESSED_TRAVEL on each side. Before the first
 *  layout the size is unknown, so it falls back to the small-control dip. */
export function pressedScaleFor(extent: number): number {
  if (extent <= 0) return PRESSED_SCALE_MIN;
  const derived = 1 - (PRESSED_TRAVEL * 2) / extent;
  return Math.min(PRESSED_SCALE_MAX, Math.max(PRESSED_SCALE_MIN, derived));
}

export interface PressableFeedbackProps extends PressableProps {
  /** Off for surfaces that aren't controls, e.g. a sheet's backdrop, so tapping it doesn't flash the screen. */
  feedback?: boolean;
  /** The spring dip while held. On by default (follows `feedback`), sized to the element; pass a number to
   *  pin the pressed scale, or `false` for the fade alone. */
  scale?: boolean | number;
  /** Buzzes on touch-down, for controls where the press itself is the answer (a primary action, a
   *  selection). Off by default: buzzing every tappable in the app makes the phone feel like it rattles. */
  haptic?: HapticKind;
}

/** Every tappable thing in the app: it answers the finger at once with a light fade and a spring dip, the
 *  same on iOS and Android, so a tap never feels missed while the work behind it runs. No colour wash:
 *  an overlay reads as a grey box on light surfaces. Reduced motion keeps the fade and drops the dip. */
export function PressableFeedback({ feedback = true, scale = feedback, haptic: hapticKind, style, ...rest }: PressableFeedbackProps) {
  const reduced = useReducedMotion();
  const responds = !rest.disabled && !!(rest.onPress || rest.onLongPress);
  const dims = feedback && responds;
  const kind = hapticKind; // a const, so the handler below keeps the narrowed (defined) type
  const buzz = kind !== undefined && responds ? () => haptic(kind) : undefined;
  // The rendered element must not change type for a control's lifetime (dropping onPress is how callers
  // disable one): swapping Pressable for AnimatedPressable remounts the subtree, which detaches refs and
  // drops press state. So the path follows `scale` alone — reduced motion is honoured by `dips`, which
  // also requires a tappable control.
  const animates = scale !== false;
  const dips = animates && responds && !reduced;
  const [pressed, setPressed] = useState(false);
  const extent = useRef(0);
  const dip = useSharedValue(1);
  const dipStyle = useAnimatedStyle(() => ({ transform: [{ scale: dip.value }] }));
  if (!animates) {
    // Plain Pressable when the caller opts out of the dip: same fade, no animated machinery.
    const pressedStyle = (state: PressableStateCallbackType) => {
      const base = typeof style === 'function' ? style(state) : style;
      return dims && state.pressed ? [base, { opacity: PRESSED_OPACITY }] : base;
    };
    return (
      <Pressable
        {...rest}
        onPressIn={buzz ? (e) => { buzz(); rest.onPressIn?.(e); } : rest.onPressIn}
        style={pressedStyle}
      />
    );
  }
  const target = typeof scale === 'number' ? scale : null;
  // Reanimated only discovers animated styles that are direct elements of the style array — a
  // function-form style is never called during its scan, so the pressed state is resolved in JS instead.
  const userStyle = typeof style === 'function' ? style({ pressed }) : style;
  return (
    <AnimatedPressable
      {...rest}
      style={[userStyle, pressed && dims ? { opacity: PRESSED_OPACITY } : null, dipStyle]}
      onLayout={(e: LayoutChangeEvent) => {
        const { width, height } = e.nativeEvent.layout;
        extent.current = Math.max(width, height);
        rest.onLayout?.(e);
      }}
      onPressIn={(e) => {
        setPressed(true);
        buzz?.();
        if (dips) dip.set(withSpring(target ?? pressedScaleFor(extent.current), springs.press));
        rest.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        setPressed(false);
        // Unconditional: a control can stop responding while it is held (its parent flips it to
        // loading/disabled), and then the dip would stick forever. Resetting 1 -> 1 is a no-op, so this
        // is always safe.
        dip.set(withSpring(1, springs.press));
        rest.onPressOut?.(e);
      }}
    />
  );
}
