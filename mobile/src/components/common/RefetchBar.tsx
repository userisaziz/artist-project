import { useEffect, useState } from 'react';
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useIsFetching } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fadeIn, useReducedMotion } from '../../core/motion/motion';
import { useTheme } from '../../core/theme/theme-provider';

const BAR_HEIGHT = 2;
const SWEEP_MS = 900;
/** A refetch that answers inside this window never shows the bar. Without the delay it blinks on every
 *  fast cache hit and on the inbox poll, which is noise rather than feedback. */
const SHOW_AFTER_MS = 250;

/** App-wide sign of life while a background refetch is in flight — coming back to the app, a tab landing
 *  on a stale query, a poll. The content on screen stays exactly where it is; this is the only motion.
 *
 *  It owns its `useIsFetching` subscription so fetch traffic re-renders this leaf and never the navigator
 *  under it, and the sweep is a UI-thread loop like `Skeleton`: React is not in the frame path. */
export function RefetchBar() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const fetching = useIsFetching() > 0;
  const [slow, setSlow] = useState(false);
  const sweep = useSharedValue(0);

  // Visible is derived, never set: the effect only arms the delay. `setSlow(false)` lives in the
  // cleanup, so a fetch that ends before SHOW_AFTER_MS disarms without a synchronous re-render.
  useEffect(() => {
    if (!fetching) return;
    const timer = setTimeout(() => { setSlow(true); }, SHOW_AFTER_MS);
    return () => { clearTimeout(timer); setSlow(false); };
  }, [fetching]);
  const visible = fetching && slow;

  useEffect(() => {
    if (reduced) {
      // Parked mid-travel: a still bar that reads as "in progress", with no loop to follow.
      sweep.set(0.5);
      return;
    }
    // Back and forth: a one-way repeat would snap the band off-frame and restart it, which reads as the
    // app stalling and starting over instead of one continuous wait.
    sweep.set(withRepeat(withTiming(1, { duration: SWEEP_MS, easing: Easing.inOut(Easing.quad) }), -1, true));
    return () => {
      cancelAnimation(sweep);
      sweep.set(0);
    };
  }, [visible, reduced, sweep]);

  const band = useAnimatedStyle(() => ({ transform: [{ translateX: `${sweep.value * 260 - 80}%` }] }));
  if (!visible) return null;

  return (
    <Animated.View
      entering={fadeIn}
      pointerEvents="none"
      accessibilityLabel="Refreshing"
      style={{
        position: 'absolute',
        top: insets.top,
        left: 0,
        right: 0,
        height: BAR_HEIGHT,
        overflow: 'hidden',
        zIndex: 10,
        backgroundColor: theme.colors.progressTrack,
      }}
    >
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            width: '34%',
            borderRadius: BAR_HEIGHT,
            backgroundColor: theme.colors.brand,
          },
          band,
        ]}
      />
    </Animated.View>
  );
}
