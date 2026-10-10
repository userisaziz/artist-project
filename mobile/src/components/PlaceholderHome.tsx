import { View } from 'react-native';
import { Screen } from './Screen';
import { AppText } from './AppText';
import { AppButton } from './AppButton';
import { useTheme } from '../theme/theme-provider';
import { useAuth } from '../auth/auth-provider';

/** Stand-in for the customer and artist homes until their Atelier screens are built. */
export function PlaceholderHome({ role }: { role: 'Customer' | 'Artist' }) {
  const theme = useTheme();
  const { user, signOut } = useAuth();
  const name = user?.first_name || user?.phone || '';
  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: theme.spacing.lg }}>
        <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: theme.colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
          <AppText variant="title" style={{ color: theme.colors.brand }}>{name.slice(0, 1).toUpperCase()}</AppText>
        </View>
        <View style={{ alignItems: 'center', gap: theme.spacing.xs }}>
          <AppText variant="title" style={{ color: theme.colors.textPrimary }}>Welcome, {name}</AppText>
          <View style={{ paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.xs, borderRadius: theme.radii.pill, backgroundColor: theme.colors.brandSoft }}>
            <AppText variant="caption" style={{ color: theme.colors.brand }}>{role}</AppText>
          </View>
        </View>
        <AppText variant="body" style={{ color: theme.colors.textSecondary, textAlign: 'center' }}>
          {role} home — built next, from the Atelier prototype
        </AppText>
        <AppButton label="Sign out" variant="ghost" onPress={() => { void signOut(); }} />
      </View>
    </Screen>
  );
}
