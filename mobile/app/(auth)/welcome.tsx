import { View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText, Accent } from '../../src/core/components/AppText';
import { AppButton } from '../../src/core/components/AppButton';
import { useTheme } from '../../src/core/theme/theme-provider';

// Atelier hi-fi "Welcome" (v4): welcome2 photo across the top 640pt, blush fade, copy + buttons at the bottom.
const HERO = require('../../assets/hero/welcome.webp');
const HERO_HEIGHT = 640;

export default function WelcomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toLogin = () => router.push('/login'); // one phone+OTP entry: the number decides sign-in vs sign-up
  const fade = theme.colors.canvas;

  return (
    <View style={{ flex: 1, backgroundColor: fade, overflow: 'hidden' }}>
      <Image
        source={HERO}
        contentFit="cover"
        contentPosition="top"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: HERO_HEIGHT, backgroundColor: theme.colors.imageFallback }}
        accessibilityIgnoresInvertColors
        testID="welcome-hero"
      />
      <LinearGradient
        colors={[`${fade}00`, `${fade}E6`, fade]}
        locations={[0, 0.3, 0.48]}
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 420 }}
        pointerEvents="none"
      />
      <View style={{ flex: 1 }} />
      <View style={{ paddingHorizontal: theme.spacing.md + theme.spacing.xs }}>
        <AppText variant="eyebrow" style={{ fontSize: 10.5, letterSpacing: 2.5, color: theme.colors.brand }}>ATELIER</AppText>
        <AppText variant="hero" style={{ fontSize: 28, lineHeight: 28, letterSpacing: -0.7, color: theme.colors.heading, marginTop: 10 }}>
          {'Discover\nyour '}<Accent light color={theme.colors.brand}>artist.</Accent>
        </AppText>
        <AppText variant="body" style={{ fontSize: 13.5, lineHeight: 20, color: theme.colors.textSecondary, marginTop: 10, maxWidth: 280 }}>
          Mehendi, makeup, photography and more, booked in minutes.
        </AppText>
      </View>
      {/* bottom: 40pt from the screen edge on notched iPhones, as designed */}
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingTop: 14, paddingBottom: Math.max(insets.bottom + 6, theme.spacing.lg), gap: 10 }}>
        <AppButton label="Get started" onPress={toLogin} />
        <AppButton label="I already have an account" variant="secondary" onPress={toLogin} />
      </View>
    </View>
  );
}
