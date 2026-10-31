import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
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
    if (reduced) return;
    sweep.set(withRepeat(withTiming(1, { duration: SWEEP_MS, easing: Easing.linear }), -1, true));
    return () => cancelAnimation(sweep);
  }, [reduced, sweep]);
  const band = useAnimatedStyle(() => ({ transform: [{ translateX: `${sweep.value * 160 - 30}%` }] }));
  return (
    <View
      accessibilityLabel="Loading"
      style={[{ height, width, borderRadius: radius ?? theme.radii.card, backgroundColor: theme.colors.canvas, overflow: 'hidden' }, style]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.surface, opacity: 0.7 }, band]} />
    </View>
  );
}
