import { Children, useEffect, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useReducedMotion } from '../../core/motion/motion';

interface CrossfadeStackProps {
  /** Index of the layer currently shown; changing it cross-fades to the new layer. */
  active: number;
  /** Cross-fade length; reduced motion collapses it to an instant swap. */
  durationMs: number;
  /** Sized container — layers fill it absolutely. */
  style?: StyleProp<ViewStyle>;
  /** One child per layer, stacked in order. */
  children: ReactNode;
}

/** Stacked layers where only `active` is visible, switching with an opacity cross-fade
 *  on the UI thread. Screens pass styled children (e.g. expo-image layers); this primitive
 *  owns the shared values, so features never import reanimated for a fade. */
export function CrossfadeStack({ active, durationMs, style, children }: CrossfadeStackProps) {
  const reduced = useReducedMotion();
  const duration = reduced ? 0 : durationMs;
  return (
    <View style={[{ overflow: 'hidden' }, style]}>
      {Children.map(children, (child, i) => (
        <FadeLayer key={i} visible={i === active} durationMs={duration}>
          {child}
        </FadeLayer>
      ))}
    </View>
  );
}

interface FadeLayerProps {
  visible: boolean;
  durationMs: number;
  children: ReactNode;
}

function FadeLayer({ visible, durationMs, children }: FadeLayerProps) {
  const opacity = useSharedValue(visible ? 1 : 0);
  useEffect(() => {
    opacity.set(withTiming(visible ? 1 : 0, { duration: durationMs }));
  }, [visible, durationMs, opacity]);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, fadeStyle]}>{children}</Animated.View>;
}
