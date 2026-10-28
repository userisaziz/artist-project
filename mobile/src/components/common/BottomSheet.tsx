import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import type { ReactNode } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from './AppText';
import { useTheme } from '../../core/theme/theme-provider';

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
        <View style={{ maxHeight: '85%', backgroundColor: theme.colors.surface, borderTopLeftRadius: theme.radii.sheet, borderTopRightRadius: theme.radii.sheet, paddingBottom: insets.bottom + theme.spacing[4] }}>
          <ScrollView contentContainerStyle={{ padding: theme.spacing[6], paddingBottom: theme.spacing[2], gap: theme.spacing[3.5] }} keyboardShouldPersistTaps="handled">
            <AppText variant="title" style={{ color: theme.colors.heading }}>{title}</AppText>
            {children}
          </ScrollView>
          {footer ? <View style={{ paddingHorizontal: theme.spacing[6] }}>{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
