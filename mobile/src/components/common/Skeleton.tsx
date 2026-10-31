import { useEffect } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useReducedMotion } from '../../core/motion/motion';
import { useTheme } from '../../core/theme/theme-provider';

const SWEEP_MS = 1200;

interface SkeletonProps {
  height?: number;
  width?: number | `${number}%`;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

/** A first-load placeholder block: a highlight band sweeping through a soft surface (the one sanctioned
 *  linear loop — loading). Reduced motion keeps the band still. Compose blocks into rows; no spinner. */
export function Skeleton({ height = 96, width, radius, style }: SkeletonProps) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const sweep = useSharedValue(0);
  useEffect(() => {
    if (reduced) {
      // Park the band off-frame instead of leaving it mid-sweep: the block then reads as one flat
      // placeholder rather than a frozen highlight nobody can explain.
      sweep.set(0);
      return;
    }
    // Forward-only: both endpoints sit off-frame, so restarting the loop is invisible. A backward
    // repeat would rewind the highlight across the block and read as a second, wrong direction.
    sweep.set(withRepeat(withTiming(1, { duration: SWEEP_MS, easing: Easing.linear }), -1, false));
    return () => {
      cancelAnimation(sweep);
      sweep.set(0);
    };
  }, [reduced, sweep]);
  // The band is 40% wide and travels -100% -> 250%, i.e. entirely off-frame on both ends. The moving
  // edge is what reads as loading: a full-width band only shifted the whole block's tone by ~1.03:1.
  const band = useAnimatedStyle(() => ({ transform: [{ translateX: `${sweep.value * 350 - 100}%` }] }));
  return (
    <View
      accessibilityLabel="Loading"
      style={[{ height, width, borderRadius: radius ?? theme.radii.card, backgroundColor: theme.colors.canvas, overflow: 'hidden' }, style]}
    >
      <Animated.View
        style={[
          { position: 'absolute', top: 0, bottom: 0, left: 0, width: '40%', backgroundColor: theme.colors.surface, opacity: 0.7 },
          band,
        ]}
      />
    </View>
  );
}
