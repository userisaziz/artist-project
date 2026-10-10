import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import type { ReactNode } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from './AppText';
import { useTheme } from '../theme/theme-provider';

/** Atelier form frame (Log in, code, sign-up): blush wash fading to white, optional round back button, keyboard-safe scroll. */
export function FormScreen({ onBack, children }: { onBack?: () => void; children: ReactNode }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      <LinearGradient colors={[theme.colors.brandSoft, theme.colors.surface]} locations={[0, 0.38]} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + theme.spacing.sm, paddingHorizontal: theme.spacing.lg, paddingBottom: insets.bottom + theme.spacing.sm }}
        >
          {onBack ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              onPress={onBack}
              style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.separator, alignItems: 'center', justifyContent: 'center' }}
            >
              <AppText style={{ fontSize: 22, lineHeight: 26, color: theme.colors.textPrimary }}>‹</AppText>
            </Pressable>
          ) : null}
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
