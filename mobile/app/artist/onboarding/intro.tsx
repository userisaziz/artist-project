import { useState } from 'react';
import { View } from 'react-native';
import { PressableFeedback } from '../../../src/components/common/PressableFeedback';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText, Accent } from '../../../src/components/common/AppText';
import { AppButton } from '../../../src/components/common/AppButton';
import { useTheme } from '../../../src/core/theme/theme-provider';
import { useAuth } from '../../../src/context/auth/auth-provider';
import { errorMessage } from '../../../src/core/api/error-message';
import { Icon } from '../../../src/components/common/Icon';

const ARTIST_PHOTO = require('../../../assets/hero/role-artist.webp');
const WELCOME_PHOTO = require('../../../assets/hero/welcome.webp');
const CLIENT_PHOTO = require('../../../assets/hero/role-customer.webp');
const BENEFITS = ['Show your work to clients near you', 'Set your own services and prices']; // payouts line dropped until payouts exist

// Atelier hi-fi "onbIntro": photo collage, headline, benefits and "5 short steps".
export default function IntroScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { chooseRole, signOut } = useAuth();
  const [escaping, setEscaping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tile = { borderRadius: 22, backgroundColor: theme.colors.imageFallback } as const;

  // The way out for someone who tapped "Offer my services" and means to browse instead: choosing customer
  // keeps the verified session and flips the root gate, so no navigation here can be a silent no-op.
  const browseAsCustomer = async () => {
    if (escaping) return;
    setEscaping(true);
    setError(null);
    try {
      await chooseRole('customer');
    } catch (e) {
      setError(errorMessage(e));
      setEscaping(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.washTop, paddingTop: insets.top + 12, paddingHorizontal: 24, paddingBottom: insets.bottom + 16 }}>
      {/* The role is already chosen, so there is nothing to go back to: the close button leaves the account,
          while "Browse as a customer" below stays signed in and switches the app side. */}
      <PressableFeedback
        accessibilityRole="button"
        accessibilityLabel="Sign out"
        onPress={() => { void signOut(); }}
        style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.surface, alignItems: 'center', justifyContent: 'center' }}
      >
        <Icon name="close" size={18} />
      </PressableFeedback>
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
            <Icon name="sparkles" size={16} color={theme.colors.brand} />
            <AppText variant="body" style={{ fontSize: 14, color: theme.colors.textSecondary }}>{line}</AppText>
          </View>
        ))}
      </View>
      <View style={{ flex: 1 }} />
      <AppText variant="caption" style={{ textAlign: 'center', color: theme.colors.textSecondary, marginBottom: 10 }}>5 short steps</AppText>
      <View style={{ gap: 8 }}>
        <AppButton label="Let’s get started" onPress={() => router.push('/artist/onboarding/profile')} disabled={escaping} />
        <AppButton label="Browse as a customer" variant="ghost" loading={escaping} onPress={() => { void browseAsCustomer(); }} />
      </View>
      {error ? <AppText variant="caption" style={{ color: theme.colors.error, marginTop: theme.spacing.sm, textAlign: 'center' }}>{error}</AppText> : null}
    </View>
  );
}
