import { View } from 'react-native';
import { Screen } from '../../src/components/Screen';
import { AppText } from '../../src/components/AppText';
import { AppButton } from '../../src/components/AppButton';
import { useTheme } from '../../src/theme/theme-provider';
import { useAuth } from '../../src/auth/auth-provider';

export default function HomeScreen() {
  const theme = useTheme();
  const { user, signOut } = useAuth();
  const name = user?.first_name || user?.phone || '';
  const role = user ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : '';
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
          Signed in — real app screens arrive in the next increment
        </AppText>
        <AppButton label="Sign out" variant="ghost" onPress={() => { void signOut(); }} />
      </View>
    </Screen>
  );
}
