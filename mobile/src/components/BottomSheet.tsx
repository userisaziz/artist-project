import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import type { ReactNode } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from './AppText';
import { useTheme } from '../theme/theme-provider';

interface BottomSheetProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Pinned below the scrolling content, e.g. the submit button. */
  footer?: ReactNode;
}

/** The Atelier bottom sheet (same shell as AddServiceSheet): a scrim that closes it, a rounded white panel. */
export function BottomSheet({ visible, title, onClose, children, footer }: BottomSheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable accessibilityLabel="Close" style={{ flex: 1, backgroundColor: theme.colors.overlay }} onPress={onClose} />
        <View style={{ maxHeight: '85%', backgroundColor: theme.colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: insets.bottom + 16 }}>
          <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 8, gap: 14 }} keyboardShouldPersistTaps="handled">
            <AppText variant="title" style={{ color: theme.colors.heading }}>{title}</AppText>
            {children}
          </ScrollView>
          {footer ? <View style={{ paddingHorizontal: 24 }}>{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
