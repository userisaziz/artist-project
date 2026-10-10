import { AppText, Accent, View, useTheme } from '@art-circle/atelier-mobile';

export function TypeScale() {
  const theme = useTheme();
  return (
    <View style={{ gap: 10, width: 340 }}>
      <AppText variant="eyebrow" style={{ color: theme.colors.brandInk }}>EYEBROW · ATELIER</AppText>
      <AppText variant="hero" style={{ color: theme.colors.textPrimary }}>Hero headline</AppText>
      <AppText variant="display" style={{ color: theme.colors.textPrimary }}>Display title</AppText>
      <AppText variant="title" style={{ color: theme.colors.textPrimary }}>Title · Bridal mehendi</AppText>
      <AppText variant="subtitle" style={{ color: theme.colors.textPrimary }}>Subtitle · Starts at ₹4,500</AppText>
      <AppText variant="body" style={{ color: theme.colors.textSecondary }}>Body · Mehendi, makeup, photography and more, booked in minutes.</AppText>
      <AppText variant="label" style={{ color: theme.colors.textSecondary }}>Label · Mobile number</AppText>
      <AppText variant="caption" style={{ color: theme.colors.textMuted }}>Caption · We'll send a 6-digit code by SMS.</AppText>
    </View>
  );
}

export function ScreenHeading() {
  const theme = useTheme();
  return (
    <View style={{ width: 340 }}>
      <AppText variant="display" style={{ color: theme.colors.textPrimary }}>
        {'Welcome '}<Accent>back</Accent>
      </AppText>
      <AppText variant="body" style={{ color: theme.colors.textMuted, marginTop: 10 }}>
        Enter your mobile number to log in or sign up. No passwords.
      </AppText>
    </View>
  );
}

export function WelcomeHero() {
  const theme = useTheme();
  return (
    <View style={{ width: 340 }}>
      <AppText variant="eyebrow" style={{ color: theme.colors.brandInk }}>ATELIER</AppText>
      <AppText variant="hero" style={{ color: theme.colors.textPrimary, marginTop: 12 }}>
        {'Discover\nyour '}<Accent light color={theme.colors.brandOnImage}>artist.</Accent>
      </AppText>
      <AppText variant="body" style={{ color: theme.colors.textPrimary, marginTop: 12, maxWidth: 250 }}>
        Mehendi, makeup, photography and more, booked in minutes.
      </AppText>
    </View>
  );
}

export function InlineLinks() {
  const theme = useTheme();
  return (
    <AppText variant="caption" style={{ width: 300, textAlign: 'center', color: theme.colors.textMuted, lineHeight: 18 }}>
      By continuing you agree to our <AppText variant="caption" style={{ color: theme.colors.brand }}>Terms</AppText> and{' '}
      <AppText variant="caption" style={{ color: theme.colors.brand }}>Privacy Policy</AppText>.
    </AppText>
  );
}
