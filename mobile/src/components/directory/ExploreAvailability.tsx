import { View } from 'react-native';
import { AppText } from '../common/AppText';
import { useTheme } from '../../core/theme/theme-provider';

/** "Available tomorrow" behind a small green dot. */
export function ExploreAvailability({ label }: { label: string }) {
  const theme = useTheme();
  const dot = theme.spacing[1.5];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[1.5] }}>
      <View style={{ width: dot, height: dot, borderRadius: theme.radii.pill, backgroundColor: theme.colors.confirmedInk }} />
      <AppText variant="caption" style={{ fontWeight: '600', color: theme.colors.confirmedInk }}>{label}</AppText>
    </View>
  );
}
