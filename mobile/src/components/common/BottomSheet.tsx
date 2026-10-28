import { useEffect, useState } from 'react';
import { Animated, Easing, KeyboardAvoidingView, Modal, Platform, ScrollView, View, useWindowDimensions } from 'react-native';
import { PressableFeedback } from './PressableFeedback';
import type { ReactNode } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from './AppText';
import { useTheme } from '../../core/theme/theme-provider';

const SLIDE_IN_MS = 240;

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
  const [offscreen] = useState(() => new Animated.Value(1)); // 1 = below the screen, 0 = in place
  useEffect(() => {
    if (!visible) {
      offscreen.setValue(1);
      return;
    }
    Animated.timing(offscreen, { toValue: 0, duration: SLIDE_IN_MS, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [visible, offscreen]);
  const translateY = offscreen.interpolate({ inputRange: [0, 1], outputRange: [0, height] });
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: theme.colors.overlay }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <PressableFeedback feedback={false} accessibilityLabel="Close" style={{ flex: 1 }} onPress={onClose} />
          <Animated.View style={{ maxHeight: '85%', backgroundColor: theme.colors.surface, borderTopLeftRadius: theme.radii.sheet, borderTopRightRadius: theme.radii.sheet, paddingBottom: insets.bottom + theme.spacing[4], transform: [{ translateY }] }}>
            <ScrollView contentContainerStyle={{ padding: theme.spacing[6], paddingBottom: theme.spacing[2], gap: theme.spacing[3.5] }} keyboardShouldPersistTaps="handled">
              <AppText variant="title" style={{ color: theme.colors.heading }}>{title}</AppText>
              {children}
            </ScrollView>
            {footer ? <View style={{ paddingHorizontal: theme.spacing[6] }}>{footer}</View> : null}
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
