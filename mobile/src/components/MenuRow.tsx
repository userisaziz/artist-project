import { Pressable } from 'react-native';
import { AppText } from './AppText';
import { useTheme } from '../theme/theme-provider';

/** A tappable settings-style row with a chevron. */
export function MenuRow({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14 }}>
      <AppText variant="body" style={{ color: theme.colors.textPrimary, fontFamily: theme.typography.label.fontFamily }}>{label}</AppText>
      <AppText style={{ color: theme.colors.textMuted }}>›</AppText>
    </Pressable>
  );
}
