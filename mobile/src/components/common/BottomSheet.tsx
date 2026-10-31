import { useEffect } from 'react';
import { Modal, ScrollView, View, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { PressableFeedback } from './PressableFeedback';
import type { ReactNode } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from './AppText';
import { KeyboardAvoider } from './KeyboardAvoider';
import { timings, useReducedMotion } from '../../core/motion/motion';
import { useTheme } from '../../core/theme/theme-provider';

interface BottomSheetProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Pinned below the scrolling content, e.g. the submit button. */
  footer?: ReactNode;
}

/** The Atelier bottom sheet (same shell as AddServiceSheet): a scrim that closes it, a rounded white panel.
 *  The scrim fades in place while only the panel slides up, on the native thread. */
export function BottomSheet({ visible, title, onClose, children, footer }: BottomSheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const offscreen = useSharedValue(1); // 1 = below the screen, 0 = in place
  useEffect(() => {
    // Hiding snaps rather than sliding out: the Modal's own fade is the exit, and a slide-down
    // underneath it reads as the panel fighting the scrim.
    if (!visible) {
      offscreen.set(1);
      return;
    }
    offscreen.set(withTiming(0, { ...timings.sheet, duration: reduced ? 0 : timings.sheet.duration }));
  }, [offscreen, reduced, visible]);
  const panel = useAnimatedStyle(() => ({ transform: [{ translateY: offscreen.value * height }] }));
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: theme.colors.overlay }}>
        <KeyboardAvoider>
          <PressableFeedback feedback={false} accessibilityLabel="Close" style={{ flex: 1 }} onPress={onClose} />
          <Animated.View style={[{ maxHeight: '85%', backgroundColor: theme.colors.surface, borderTopLeftRadius: theme.radii.sheet, borderTopRightRadius: theme.radii.sheet, paddingBottom: insets.bottom + theme.spacing[4] }, panel]}>
            <ScrollView contentContainerStyle={{ padding: theme.spacing[6], paddingBottom: theme.spacing[2], gap: theme.spacing[3.5] }} keyboardShouldPersistTaps="handled">
              <AppText variant="title" style={{ color: theme.colors.heading }}>{title}</AppText>
              {children}
            </ScrollView>
            {footer ? <View style={{ paddingHorizontal: theme.spacing[6] }}>{footer}</View> : null}
          </Animated.View>
        </KeyboardAvoider>
      </View>
    </Modal>
  );
}
