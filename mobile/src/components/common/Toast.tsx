import { useEffect } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { toastMotion, useReducedMotion } from '../../core/motion/motion';
import { useTheme } from '../../core/theme/theme-provider';
import { dismissToast, useToastMessage } from '../../core/toast/toast';
import { AppText } from './AppText';
import { PressableFeedback } from './PressableFeedback';

const DOT = 8;

/** The single place a toast is drawn: one card under the header, top of the screen, above every route.
 *  Mount it once in `app/_layout.tsx`; raise messages with `toast()` from anywhere.
 *
 *  The lane stays mounted and the card comes and goes inside it, so Reanimated's layout animations can
 *  play the exit after the card has left the tree — nothing here has to keep the last words around. */
export function ToastHost() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const message = useToastMessage();
  const { entering, exiting } = toastMotion(useReducedMotion());
  useEffect(() => {
    // Android reads the live region itself; iOS has no equivalent, so it is announced by hand.
    if (!message || Platform.OS !== 'ios') return;
    AccessibilityInfo.announceForAccessibility(message.body ? `${message.title}. ${message.body}` : message.title);
  }, [message]);
  return (
    <View
      pointerEvents="box-none"
      accessibilityLiveRegion="polite"
      style={[styles.lane, { top: insets.top + theme.spacing[2], left: theme.spacing.md, right: theme.spacing.md }]}
    >
      {/* Keyed by message id: a newer message replaces the card rather than editing it in place. */}
      {message ? (
        <Animated.View key={message.id} entering={entering} exiting={exiting}>
          <PressableFeedback
            accessibilityRole="button"
            accessibilityLabel={message.title}
            accessibilityHint="Dismiss"
            onPress={dismissToast}
            style={[
              {
                flexDirection: 'row', gap: theme.spacing[2.5], alignItems: 'flex-start',
                paddingVertical: theme.spacing[3.5], paddingHorizontal: theme.spacing[4],
                borderRadius: theme.radii.md, backgroundColor: theme.colors.surface,
              },
              theme.shadows.md,
            ]}
          >
            <View
              style={{
                width: DOT, height: DOT, borderRadius: DOT / 2, marginTop: theme.spacing[1.5],
                backgroundColor: message.tone === 'error' ? theme.colors.error : theme.colors.success,
              }}
            />
            <View style={{ flex: 1, gap: theme.spacing[0.5] }}>
              <AppText variant="labelLg" style={{ color: theme.colors.textPrimary }}>{message.title}</AppText>
              {message.body ? <AppText variant="caption" style={{ color: theme.colors.textMuted }}>{message.body}</AppText> : null}
            </View>
          </PressableFeedback>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // The lane ignores touches; only the card inside it takes them, so the screen below stays usable.
  lane: { position: 'absolute', zIndex: 10, elevation: 10 },
});
