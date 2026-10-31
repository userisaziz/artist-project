import { useEffect, useState } from 'react';
import {
  Easing, FadeIn, FadeInDown, FadeOut, FadeOutUp, useReducedMotion as useReanimatedReducedMotion,
} from 'react-native-reanimated';
import { motionDurations, motionEasing, motionSprings, motionStagger } from '../theme/tokens/motion';

/** The Premium motion vocabulary. Every duration, easing and spring derives from the generated tokens —
 *  components consume this module (or the shared primitives) and never import reanimated directly. */

export const useReducedMotion = useReanimatedReducedMotion;

const bezier = ([x1, y1, x2, y2]: readonly [number, number, number, number]) => Easing.bezier(x1, y1, x2, y2);

/** Timed moves: entrances and on-screen changes use the signature decelerate curve, exits accelerate out. */
export const timings = {
  quick: { duration: motionDurations.quick, easing: bezier(motionEasing.standard) },
  base: { duration: motionDurations.base, easing: bezier(motionEasing.standard) },
  enter: { duration: motionDurations.enter, easing: bezier(motionEasing.standard) },
  reveal: { duration: motionDurations.reveal, easing: bezier(motionEasing.standard) },
  sheet: { duration: motionDurations.slow, easing: bezier(motionEasing.standard) },
  exit: { duration: motionDurations.slow, easing: bezier(motionEasing.exit) },
} as const;

/** The toast lane: it drops in from above its resting place and lifts back out, the mirror of
 *  `fadeRise`, so a message never reads as a card inserted into the page. Layout animations own the
 *  exit — the host unmounts the card and Reanimated finishes the motion, so no component has to hold
 *  the last words just to fade them. Reduced motion cuts both ends to nothing. */
export function toastMotion(reduced: boolean) {
  if (reduced) return { entering: FadeIn.duration(0), exiting: FadeOut.duration(0) };
  return {
    entering: FadeInDown.duration(motionDurations.enter).easing(bezier(motionEasing.standard)),
    exiting: FadeOutUp.duration(motionDurations.quick).easing(bezier(motionEasing.exit)),
  };
}

/** Springs are for interactions only — entrances use `timings`. */
export const springs = motionSprings;

/** The one entrance style: fade + 12px rise over `enter`, staggered by index. Reduced motion collapses
 *  it to a plain quick fade with no travel. */
export function fadeRise(delayMs: number, reduced: boolean) {
  if (reduced) return FadeIn.duration(motionDurations.quick);
  return FadeInDown.duration(motionDurations.enter).easing(bezier(motionEasing.standard)).delay(delayMs);
}

/** Micro-cascade: index × step, capped at maxItems so the total stays inside the 500ms budget —
 *  beyond the cap, rows enter immediately (delay 0) rather than clamping to the last slot. */
export function staggerDelay(index: number): number {
  return index < motionStagger.maxItems ? index * motionStagger.stepMs : 0;
}

/** The placeholder → content swap. The skeleton fades out in `quick` and whatever arrives fades in behind
 *  it, so a load never hard-cuts. Opacity only, which stays sanctioned under reduced motion. */
export const placeholderExit = FadeOut.duration(motionDurations.quick);
export const fadeIn = FadeIn.duration(motionDurations.base).easing(bezier(motionEasing.standard));

/** How long the first-batch entrance window stays open: enter + full stagger, with headroom. */
export const ENTRANCE_WINDOW_MS = motionDurations.enter + motionStagger.maxItems * motionStagger.stepMs + 150;

/** True only while the list's first batch may animate. The first items open a one-shot window;
 *  once it closes it stays closed for the lifetime of the list, so rows mounted later (pagination,
 *  scroll-back recycling, refetches) render instantly instead of replaying the entrance mid-scroll. */
export function useEntranceWindow(hasItems: boolean): boolean {
  const [armed, setArmed] = useState(true);
  useEffect(() => {
    if (!hasItems) return;
    const timer = setTimeout(() => setArmed(false), ENTRANCE_WINDOW_MS);
    return () => clearTimeout(timer);
  }, [hasItems]);
  return armed;
}
