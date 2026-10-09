import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText, Accent } from '../../src/components/AppText';
import { AppButton } from '../../src/components/AppButton';
import { useTheme } from '../../src/theme/theme-provider';

// Atelier hi-fi "Welcome" (v2). The full-bleed photo (assets/hero/welcome.jpg in the design project)
// is pending a compressed export; imageFallback is the prototype's own background behind it.
export default function WelcomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toLogin = () => router.push('/login'); // one phone+OTP entry: the number decides sign-in vs sign-up
  const fade = theme.colors.surface;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.imageFallback, overflow: 'hidden' }}>
      <LinearGradient
        colors={[`${fade}00`, `${fade}D9`, fade]}
        locations={[0, 0.45, 0.7]}
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 300 }}
        pointerEvents="none"
      />
      <View style={{ paddingTop: insets.top + theme.spacing.xl + theme.spacing.sm, paddingHorizontal: theme.spacing.lg }}>
        <AppText variant="eyebrow" style={{ color: theme.colors.brandInk }}>ATELIER</AppText>
        <AppText variant="hero" style={{ color: theme.colors.textPrimary, marginTop: theme.spacing.md - theme.spacing.xs }}>
          {'Discover\nyour '}<Accent color={theme.colors.brandOnImage}>artist.</Accent>
        </AppText>
        <AppText variant="body" style={{ color: theme.colors.textPrimary, marginTop: theme.spacing.md - theme.spacing.xs, maxWidth: 250 }}>
          Mehendi, makeup, photography and more, booked in minutes.
        </AppText>
      </View>
      <View style={{ flex: 1 }} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: insets.bottom + theme.spacing.xl, gap: theme.spacing.sm + 2 }}>
        <AppButton label="Get started" onPress={toLogin} />
        <AppButton label="I already have an account" variant="secondary" onPress={toLogin} />
      </View>
    </View>
  );
}
