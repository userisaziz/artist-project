import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppText } from './AppText';
import { useTheme } from '../../core/theme/theme-provider';

interface BackHeaderProps {
  title?: string;
  /** Small caption on the right, e.g. "Step 1 of 2". */
  step?: string;
  onBack?: () => void;
}

/** Round back button with an optional title, for screens pushed above the tabs. */
export function BackHeader({ title, step, onBack }: BackHeaderProps) {
  const theme = useTheme();
  const router = useRouter();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={onBack ?? (() => router.back())}
        hitSlop={8}
        style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.separator, alignItems: 'center', justifyContent: 'center' }}
      >
        <AppText style={{ fontSize: 20, lineHeight: 24, color: theme.colors.textPrimary }}>‹</AppText>
      </Pressable>
      <AppText variant="title" style={{ flex: 1, color: theme.colors.heading }}>{title ?? ''}</AppText>
      {step ? <AppText variant="caption" style={{ color: theme.colors.textMuted }}>{step}</AppText> : null}
    </View>
  );
}
