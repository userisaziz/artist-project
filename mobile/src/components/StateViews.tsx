import { ActivityIndicator, View } from 'react-native';
import { AppText } from './AppText';
import { AppButton } from './AppButton';
import { useTheme } from '../theme/theme-provider';
import { errorMessage } from '../api/error-message';

/** Centered spinner for a first load. */
export function LoadingView({ label = 'Loading' }: { label?: string }) {
  const theme = useTheme();
  return (
    <View accessibilityLabel={label} style={{ paddingVertical: theme.spacing.xl, alignItems: 'center' }}>
      <ActivityIndicator color={theme.colors.brand} />
    </View>
  );
}

/** A failed load: the server's message (or the generic one) with Try again. */
export function ErrorView({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const theme = useTheme();
  return (
    <View style={{ paddingVertical: theme.spacing.lg, gap: theme.spacing.md }}>
      <AppText variant="body" style={{ color: theme.colors.textSecondary, textAlign: 'center' }}>{errorMessage(error)}</AppText>
      <AppButton label="Try again" variant="secondary" onPress={onRetry} />
    </View>
  );
}

export function EmptyView({ message }: { message: string }) {
  const theme = useTheme();
  return (
    <View style={{ paddingVertical: theme.spacing.xl, paddingHorizontal: theme.spacing.md, borderRadius: theme.radii.card, backgroundColor: theme.colors.canvas }}>
      <AppText variant="body" style={{ color: theme.colors.textSecondary, textAlign: 'center' }}>{message}</AppText>
    </View>
  );
}
