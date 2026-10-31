import type { ReactNode } from 'react';
import { View, type NativeScrollEvent, type NativeSyntheticEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { useReducedMotion } from '../../core/motion/motion';

/** The scroll-linked vocabulary. Screens call `useScrollLinked`, hand `onScroll` to their scroller and
 *  pass `scrollY` to the motion components below; only this primitive touches reanimated. */

export type ScrollY = SharedValue<number>;

interface ScrollLinked {
  /** Live scroll offset, updated on the UI thread every frame — never setState here. */
  scrollY: ScrollY;
  /** Animated event handler for the scroller's `onScroll`; works on ScrollView and FlashList alike. */
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  /** Fire the handler every ~16ms instead of once per gesture — the price of frame-rate motion. */
  scrollEventThrottle: 16;
}

export function useScrollLinked(): ScrollLinked {
  const scrollY = useSharedValue(0);
  const handler = useAnimatedScrollHandler((e) => {
    scrollY.set(e.contentOffset.y);
  });
  return { scrollY, onScroll: handler, scrollEventThrottle: 16 };
}

interface CollapseOnScrollProps {
  scrollY: ScrollY;
  /** Travel in px over which the block fades out and lifts — the iOS large-title collapse. */
  range?: number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** The collapsing header: opacity + translateY only, both free properties, clamped so scrolling
 *  past the range can never bring the block back. Reduced motion renders it statically. */
export function CollapseOnScroll({ scrollY, range = 60, children, style }: CollapseOnScrollProps) {
  const reduced = useReducedMotion();
  const animStyle = useAnimatedStyle(() => {
    if (reduced) return {};
    const p = interpolate(scrollY.get(), [0, range], [1, 0], Extrapolation.CLAMP);
    return { opacity: p, transform: [{ translateY: (p - 1) * 12 }] };
  }, [reduced, range]);
  return <Animated.View style={[style, reduced ? undefined : animStyle]}>{children}</Animated.View>;
}

interface ParallaxProps {
  scrollY: ScrollY;
  /** Fraction of the scroll the layer absorbs: 0 is normal flow, 1 never moves. 0.3-0.4 reads premium. */
  rate?: number;
  /** Max extra px of image carried above the crop — also the budget before the shift clamps. */
  distance?: number;
  /** The box height the layer is clipped to. */
  height: number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** Depth on scroll: the layer sinks `rate` px per scrolled px, so it leaves the viewport slower than
 *  the page. The oversized layer (height + distance) clipped by `overflow: hidden` means the crop
 *  never exposes a gap at either edge, and only `transform` moves — no layout pass competes with
 *  the scroll. */
export function Parallax({ scrollY, rate = 0.35, distance = 42, height, children, style }: ParallaxProps) {
  const reduced = useReducedMotion();
  const layerStyle = useAnimatedStyle(() => {
    if (reduced) return {};
    const shift = interpolate(scrollY.get(), [0, distance / rate], [0, distance], Extrapolation.CLAMP);
    return { transform: [{ translateY: shift }] };
  }, [reduced, rate, distance]);
  return (
    <View style={[{ height, overflow: 'hidden' }, style]}>
      <Animated.View style={[{ position: 'absolute', top: -distance, left: 0, right: 0, height: height + distance }, layerStyle]}>
        {children}
      </Animated.View>
    </View>
  );
}
