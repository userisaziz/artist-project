import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  cancelAnimation, Easing, interpolate, useAnimatedProps, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming,
} from 'react-native-reanimated';
import Svg, { G, Path, Rect } from 'react-native-svg';
import { useReducedMotion } from '../../core/motion/motion';
import { useTheme } from '../../core/theme/theme-provider';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** `sm` stands in for an inline spinner (buttons, badges, photo slots); `md` is a list footer or a wait
 *  with room around it. */
export type BrushLoaderSize = 'sm' | 'md';
/** `brand` on light surfaces; `onBrand` on a brand fill or a dark photo, where it paints in white. */
export type BrushLoaderTone = 'brand' | 'onBrand';

interface BrushLoaderProps {
  size?: BrushLoaderSize;
  tone?: BrushLoaderTone;
  testID?: string;
}

// Geometry, in viewBox units. The stroke is one gentle S-curve; the brush tip rides it.
const VIEW_W = 64;
const VIEW_H = 48;
const CURVE = [[4, 38], [16, 26], [32, 44], [46, 30]] as const;
const STROKE_D = `M${CURVE[0].join(' ')} C${CURVE[1].join(' ')} ${CURVE[2].join(' ')} ${CURVE[3].join(' ')}`;
// Measured arc length of STROKE_D (the curve is near-uniform in t, so the tip and the dash stay in step).
const STROKE_LEN = 45;
// The brush is drawn in a square box whose centre is the bristle tip, so a View transform rotates it about
// the tip and positioning the tip is just centring the box on the curve.
const BRUSH_BOX = 56;
const SCALE: Record<BrushLoaderSize, number> = { sm: 0.5, md: 0.875 };

const PAINT_MS = 900;
const LIFT_MS = 600;

/** A point on the stroke's cubic Bézier at t ∈ [0, 1]. */
function curveAt(t: number, axis: 0 | 1): number {
  'worklet';
  const u = 1 - t;
  return u * u * u * CURVE[0][axis] + 3 * u * u * t * CURVE[1][axis] + 3 * u * t * t * CURVE[2][axis] + t * t * t * CURVE[3][axis];
}

/**
 * The app's busy indicator: a makeup brush sweeping a blush stroke, then lifting while the stroke wipes
 * away from its tail. Replaces `ActivityIndicator` everywhere. One cycle is `progress` 0 → 2:
 * 0–1 paints (dash reveals, brush rides the curve), 1–2 lifts (tail erases, brush rises and fades), so the
 * reset to 0 lands on an empty, brush-less frame and the loop never visibly jumps.
 * Reduced motion parks it on a finished stroke with the brush at rest.
 */
export function BrushLoader({ size = 'sm', tone = 'brand', testID }: BrushLoaderProps) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const progress = useSharedValue(1);
  const scale = SCALE[size];

  useEffect(() => {
    if (reduced) {
      progress.set(1);
      return;
    }
    progress.set(0);
    progress.set(withRepeat(
      withSequence(
        withTiming(1, { duration: PAINT_MS, easing: Easing.inOut(Easing.cubic) }),
        withTiming(2, { duration: LIFT_MS, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    ));
    return () => { cancelAnimation(progress); };
  }, [reduced, progress]);

  // Paint: offset L → 0 reveals the dash from the head. Lift: 0 → -L slides the dash's gap in from the
  // tail, so the stroke wipes toward where the brush left it.
  const strokeProps = useAnimatedProps(() => ({
    strokeDashoffset: progress.value <= 1 ? STROKE_LEN * (1 - progress.value) : -STROKE_LEN * (progress.value - 1),
  }));

  const brush = useAnimatedStyle(() => {
    const t = Math.min(progress.value, 1);
    const lift = interpolate(progress.value, [1, 2], [0, -4], 'clamp');
    // A small wrist wobble while painting: bristles trail the motion, then settle upright.
    const wobble = interpolate(progress.value, [0, 0.5, 1, 2], [8, -6, 0, 0], 'clamp');
    return {
      opacity: interpolate(progress.value, [0, 0.12, 1.6, 2], [0, 1, 1, 0], 'clamp'),
      transform: [
        { translateX: (curveAt(t, 0) - BRUSH_BOX / 2) * scale },
        { translateY: (curveAt(t, 1) + lift - BRUSH_BOX / 2) * scale },
        { rotate: `${wobble}deg` },
      ],
    };
  });

  const onBrand = tone === 'onBrand';
  const handle = onBrand ? theme.colors.textOnBrand : theme.colors.loaderHandle;
  const ferrule = onBrand ? theme.colors.sheen : theme.colors.loaderFerrule;
  const bristle = onBrand ? theme.colors.textOnBrand : theme.colors.loaderBristle;
  const stroke = onBrand ? theme.colors.sheen : theme.colors.loaderStroke;

  return (
    // Carries no label of its own: the surrounding control (busy state) or placeholder owns the announcement.
    <View testID={testID} style={{ width: VIEW_W * scale, height: VIEW_H * scale }}>
      <Svg width={VIEW_W * scale} height={VIEW_H * scale} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}>
        <AnimatedPath d={STROKE_D} stroke={stroke} strokeWidth={7} strokeLinecap="round" fill="none" strokeDasharray={[STROKE_LEN, STROKE_LEN]} animatedProps={strokeProps} />
        {/* The glaze along the top of the wet stroke: what makes it read as cream rather than a line. */}
        <G transform="translate(0 -1.6)">
          <AnimatedPath d={STROKE_D} stroke={theme.colors.sheen} strokeWidth={1.6} strokeLinecap="round" fill="none" strokeDasharray={[STROKE_LEN, STROKE_LEN]} animatedProps={strokeProps} />
        </G>
      </Svg>
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, top: 0, width: BRUSH_BOX * scale, height: BRUSH_BOX * scale }, brush]}>
        <Svg width={BRUSH_BOX * scale} height={BRUSH_BOX * scale} viewBox={`0 0 ${BRUSH_BOX} ${BRUSH_BOX}`}>
          {/* Drawn along +x from the tip at the origin, then tilted up-right like a hand holds it. */}
          <G transform={`translate(${BRUSH_BOX / 2} ${BRUSH_BOX / 2}) rotate(-55)`}>
            <Path d="M0 0 C2 -2.8 5.5 -3.4 7.4 -3 L7.4 3 C5.5 3.4 2 2.8 0 0 Z" fill={bristle} />
            <Rect x={7.2} y={-2.9} width={4.4} height={5.8} rx={0.8} fill={ferrule} />
            <Path d="M11.4 -2.4 L26 -1.3 Q27.6 0 26 1.3 L11.4 2.4 Z" fill={handle} />
            <Path d="M12.5 -1.4 L24 -0.8" stroke={theme.colors.sheen} strokeWidth={0.8} strokeLinecap="round" />
          </G>
        </Svg>
      </Animated.View>
    </View>
  );
}
