import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ReactNode } from 'react';
import { useTheme } from '../theme/theme-provider';

export function Screen({ children, scroll = false, keyboardOffset = true }: { children: ReactNode; scroll?: boolean; keyboardOffset?: boolean }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const body = scroll ? (
    <ScrollView contentContainerStyle={{ flexGrow: 1, padding: theme.spacing.lg, paddingBottom: insets.bottom + theme.spacing.xl }} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  ) : (
    <View style={{ flex: 1, padding: theme.spacing.lg }}>{children}</View>
  );
  return (
    <View style={[{ flex: 1, backgroundColor: theme.colors.background, paddingTop: insets.top }, Platform.OS === 'web' && { paddingTop: 40 }]}>
      {keyboardOffset ? (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          {body}
        </KeyboardAvoidingView>
      ) : body}
    </View>
  );
}
