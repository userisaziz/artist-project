import { Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ReactNode } from 'react';
import { KeyboardAvoider } from './KeyboardAvoider';
import { useTheme } from '../../core/theme/theme-provider';

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
    <View style={[{ flex: 1, backgroundColor: theme.colors.background, paddingTop: insets.top }, Platform.OS === 'web' && { paddingTop: theme.spacing[10] }]}>
      {keyboardOffset ? (
        <KeyboardAvoider>
          {body}
        </KeyboardAvoider>
      ) : body}
    </View>
  );
}
