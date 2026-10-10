import { Screen, AppText, AppButton, View, useTheme } from '@art-circle/atelier-mobile';

const noop = () => {};

export function SignedInHome() {
  const theme = useTheme();
  return (
    <View style={{ width: 393, height: 520 }}>
      <Screen>
        <AppText variant="eyebrow" style={{ color: theme.colors.brandInk }}>CUSTOMER</AppText>
        <AppText variant="display" style={{ color: theme.colors.textPrimary, marginTop: 8 }}>Welcome, Ananya</AppText>
        <AppText variant="body" style={{ color: theme.colors.textSecondary, marginTop: 8 }}>
          Browse mehendi and makeup artists near you.
        </AppText>
        <View style={{ flex: 1 }} />
        <AppButton label="Sign out" variant="secondary" onPress={noop} />
      </Screen>
    </View>
  );
}

export function Scrolling() {
  const theme = useTheme();
  return (
    <View style={{ width: 393, height: 520 }}>
      <Screen scroll>
        <AppText variant="display" style={{ color: theme.colors.textPrimary }}>Bookings</AppText>
        {['Bridal mehendi · Sat 12 Oct', 'Party makeup · Sun 13 Oct', 'Engagement shoot · Fri 18 Oct', 'Sangeet mehendi · Sat 26 Oct'].map((item) => (
          <View key={item} style={{ marginTop: 16, padding: 16, borderRadius: theme.radii.md, borderWidth: 1, borderColor: theme.colors.separator }}>
            <AppText variant="subtitle" style={{ color: theme.colors.textPrimary }}>{item}</AppText>
            <AppText variant="caption" style={{ color: theme.colors.textMuted, marginTop: 4 }}>Confirmed</AppText>
          </View>
        ))}
      </Screen>
    </View>
  );
}
