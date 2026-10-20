import { useState } from 'react';
import { View } from 'react-native';
import { AppText } from '../common/AppText';
import { AppButton } from '../common/AppButton';
import { useTheme } from '../../core/theme/theme-provider';

interface Props {
  /** Re-runs the session restore; resolves once it has settled either way. */
  onRetry: () => Promise<void>;
}

/** Cold start could not check the saved session (offline, timeout, server down). The session is kept, so retry. */
export function SessionUnavailable({ onRetry }: Props) {
  const theme = useTheme();
  const [retrying, setRetrying] = useState(false);
  const retry = async () => {
    setRetrying(true);
    try {
      await onRetry();
    } finally {
      setRetrying(false);
    }
  };
  return (
    <View style={{ flex: 1, justifyContent: 'center', gap: theme.spacing.lg, padding: theme.spacing.lg, backgroundColor: theme.colors.background }}>
      <View style={{ gap: theme.spacing.sm }}>
        <AppText variant="title" style={{ color: theme.colors.textPrimary, textAlign: 'center' }}>Can’t reach the server</AppText>
        <AppText variant="body" style={{ color: theme.colors.textSecondary, textAlign: 'center' }}>
          Check your connection and try again. You’re still signed in.
        </AppText>
      </View>
      <AppButton label="Try again" loading={retrying} onPress={() => { void retry(); }} />
    </View>
  );
}
