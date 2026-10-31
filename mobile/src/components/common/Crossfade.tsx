import { useEffect, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { timings, useReducedMotion } from '../../core/motion/motion';

interface CrossfadeProps {
  /** True for the layer on top. False keeps it mounted at zero opacity, so the stack never pops. */
  visible: boolean;
  /** A blend between two images wants longer than an entrance; defaults to the reveal timing. */
  durationMs?: number;
  children: ReactNode;
}

/** One layer of a stack that fades rather than mounts — the Home hero's photos. It fills its parent and
 *  ignores touches, so the caller positions the parent once and maps its layers. */
export function Crossfade({ visible, durationMs = timings.reveal.duration, children }: CrossfadeProps) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(visible ? 1 : 0);
  useEffect(() => {
    progress.set(withTiming(visible ? 1 : 0, { ...timings.reveal, duration: reduced ? 0 : durationMs }));
  }, [durationMs, progress, reduced, visible]);
  const fade = useAnimatedStyle(() => ({ opacity: progress.value }));
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, fade]}>{children}</Animated.View>;
}
