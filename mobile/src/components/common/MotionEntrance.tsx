import type { ReactNode } from 'react';
import Animated from 'react-native-reanimated';
import { fadeRise, staggerDelay, useReducedMotion } from '../../core/motion/motion';

interface MotionEntranceProps {
  /** Position in the list — drives the stagger (capped at 8 items). */
  index: number;
  /** False once useEntranceWindow has closed: the item renders without an entrance. */
  armed: boolean;
  children: ReactNode;
}

/** The one entrance pattern (fade + rise, staggered by index). Wrap list items with it and arm it from
 *  `useEntranceWindow` so recycled rows never replay the animation mid-scroll. */
export function MotionEntrance({ index, armed, children }: MotionEntranceProps) {
  const reduced = useReducedMotion();
  return (
    <Animated.View entering={armed ? fadeRise(staggerDelay(index), reduced) : undefined}>
      {children}
    </Animated.View>
  );
}
