import { View } from 'react-native';
import { useTheme } from '../theme/theme-provider';
import { AppText } from './AppText';

export function Logo({ compact = false }: { compact?: boolean }) {
  const theme = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: theme.spacing.xs }}>
      <AppText variant="display" style={{ color: theme.colors.brand }}>Atelier</AppText>
      {!compact && (
        <AppText variant="caption" style={{ color: theme.colors.textMuted }}>
          mehendi · makeup · artists near you
        </AppText>
      )}
    </View>
  );
}
