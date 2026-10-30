import { useEffect, useState } from 'react';
import { Easing, FadeIn, FadeInDown, useReducedMotion as useReanimatedReducedMotion } from 'react-native-reanimated';
import { motionDurations, motionEasing, motionSprings, motionStagger } from '../theme/tokens/motion';

/** The Premium motion vocabulary. Every duration, easing and spring derives from the generated tokens —
 *  components consume this module (or the shared primitives) and never import reanimated directly. */

export const useReducedMotion = useReanimatedReducedMotion;

const bezier = (points: readonly number[]) => Easing.bezier(points[0], points[1], points[2], points[3]);

/** Timed moves: entrances and on-screen changes use the signature decelerate curve, exits accelerate out. */
export const timings = {
  quick: { duration: motionDurations.quick, easing: bezier(motionEasing.standard) },
  base: { duration: motionDurations.base, easing: bezier(motionEasing.standard) },
  enter: { duration: motionDurations.enter, easing: bezier(motionEasing.standard) },
  reveal: { duration: motionDurations.reveal, easing: bezier(motionEasing.standard) },
  exit: { duration: motionDurations.slow, easing: bezier(motionEasing.exit) },
} as const;

/** Springs are for interactions only — entrances use `timings`. */
export const springs = motionSprings;

/** The one entrance style: fade + 12px rise over `enter`, staggered by index. Reduced motion collapses
 *  it to a plain quick fade with no travel. */
export function fadeRise(delayMs: number, reduced: boolean) {
  if (reduced) return FadeIn.duration(motionDurations.quick);
  return FadeInDown.duration(motionDurations.enter).easing(bezier(motionEasing.standard)).delay(delayMs);
}

/** Micro-cascade: index × step, capped at maxItems so the total stays inside the 500ms budget. */
export function staggerDelay(index: number): number {
  return index < motionStagger.maxItems ? index * motionStagger.stepMs : 0;
}

/** How long the first-batch entrance window stays open: enter + full stagger, with headroom. */
export const ENTRANCE_WINDOW_MS = motionDurations.enter + motionStagger.maxItems * motionStagger.stepMs + 150;

/** True only while the list's first batch may animate. The first render with items opens a one-shot
 *  window; once it closes, rows mounted later (pagination, scroll-back recycling) render instantly
 *  instead of replaying the entrance mid-scroll. */
export function useEntranceWindow(hasItems: boolean): boolean {
  const [armed, setArmed] = useState(true);
  useEffect(() => {
    if (!hasItems) return;
    const timer = setTimeout(() => setArmed(false), ENTRANCE_WINDOW_MS);
    return () => clearTimeout(timer);
  }, [hasItems]);
  return armed;
}
