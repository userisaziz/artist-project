import { View } from 'react-native';
import { AppText } from './AppText';
import { useTheme } from '../theme/theme-provider';

interface InfoRowProps {
  label: string;
  value: string;
  strong?: boolean;
  /** Value colour override, e.g. brand for "You earn". */
  tint?: string;
}

/** A label on the left and its value on the right (summaries and price breakdowns). */
export function InfoRow({ label, value, strong = false, tint }: InfoRowProps) {
  const theme = useTheme();
  const text = strong ? theme.typography.subtitle : theme.typography.body;
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 6 }}>
      <AppText style={[text, { color: strong ? theme.colors.textPrimary : theme.colors.textSecondary }]}>{label}</AppText>
      <AppText style={[text, { flexShrink: 1, textAlign: 'right', color: tint ?? theme.colors.textPrimary }]}>{value}</AppText>
    </View>
  );
}
