import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText, Accent } from '../../../src/components/AppText';
import { AppButton } from '../../../src/components/AppButton';
import { useTheme } from '../../../src/theme/theme-provider';
import { useAuth } from '../../../src/auth/auth-provider';

const ARTIST_PHOTO = require('../../../assets/hero/role-artist.webp');
const WELCOME_PHOTO = require('../../../assets/hero/welcome.webp');
const CLIENT_PHOTO = require('../../../assets/hero/role-customer.webp');
const BENEFITS = ['Show your work to clients near you', 'Set your own services and prices']; // payouts line dropped until payouts exist

// Atelier hi-fi "onbIntro": photo collage, headline, benefits and "3 short steps".
export default function IntroScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const tile = { borderRadius: 22, backgroundColor: theme.colors.imageFallback } as const;
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.washTop, paddingTop: insets.top + 12, paddingHorizontal: 24, paddingBottom: insets.bottom + 16 }}>
      {/* The role is already chosen, so there is nothing to go back to: ✕ signs out, like Back on sign-up. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Sign out"
        onPress={() => { void signOut(); }}
        style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.surface, alignItems: 'center', justifyContent: 'center' }}
      >
        <AppText style={{ fontSize: 16, color: theme.colors.textPrimary }}>✕</AppText>
      </Pressable>
      <View style={{ flexDirection: 'row', gap: 8, height: 308, marginTop: 18 }}>
        <Image source={ARTIST_PHOTO} contentFit="cover" style={[tile, { flex: 1.2 }]} />
        <View style={{ flex: 1, gap: 8 }}>
          <Image source={WELCOME_PHOTO} contentFit="cover" style={[tile, { flex: 1 }]} />
          <Image source={CLIENT_PHOTO} contentFit="cover" style={[tile, { flex: 1 }]} />
        </View>
      </View>
      <AppText variant="display" style={{ fontSize: 36, lineHeight: 38, letterSpacing: -0.9, color: theme.colors.heading, marginTop: 26 }}>
        {'Turn your craft into '}<Accent light color={theme.colors.brand}>bookings</Accent>
      </AppText>
      <View style={{ gap: 10, marginTop: 18 }}>
        {BENEFITS.map((line) => (
          <View key={line} style={{ flexDirection: 'row', gap: 10 }}>
            <AppText style={{ color: theme.colors.brand }}>✦</AppText>
            <AppText variant="body" style={{ fontSize: 14, color: theme.colors.textSecondary }}>{line}</AppText>
          </View>
        ))}
      </View>
      <View style={{ flex: 1 }} />
      <AppText variant="caption" style={{ textAlign: 'center', color: theme.colors.textSecondary, marginBottom: 10 }}>3 short steps</AppText>
      <AppButton label="Let’s get started" onPress={() => router.push('/artist/onboarding/profile')} />
    </View>
  );
}
