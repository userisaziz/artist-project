import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText, Accent } from '../../src/components/AppText';
import { AppButton } from '../../src/components/AppButton';
import { useTheme } from '../../src/theme/theme-provider';

// Atelier hi-fi "Welcome". The hero photo is pending (prototype assets were too large to import);
// the blush field stands in for it until a compressed image lands in assets/.
export default function WelcomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toLogin = () => router.push('/login'); // one phone+OTP entry: the number decides sign-in vs sign-up

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.brandSoft }}>
      <LinearGradient
        colors={[`${theme.colors.brandSoft}00`, theme.colors.brandSoft]}
        locations={[0, 0.85]}
        style={{ position: 'absolute', left: 0, right: 0, top: '40%', height: '28%' }}
        pointerEvents="none"
      />
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'flex-end', paddingHorizontal: theme.spacing.lg, paddingTop: insets.top }}>
        <AppText variant="hero" style={{ color: theme.colors.textPrimary, textAlign: 'right' }}>
          {'Discover\nyour '}<Accent>artist</Accent>
        </AppText>
      </View>
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: insets.bottom + theme.spacing.xl, gap: theme.spacing.md }}>
        <View style={{ alignItems: 'center' }}>
          <Svg width={28} height={18} viewBox="0 0 28 18" fill="none" stroke={theme.colors.accent} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M14 9C10 3 3 1 2 5s5 7 12 4zM14 9c4-6 11-8 12-4s-5 7-12 4z" />
            <Path d="M13 10l-3 7M15 10l3 7" />
          </Svg>
        </View>
        <AppText variant="body" style={{ color: theme.colors.textSecondary, textAlign: 'center' }}>
          Mehendi, makeup, photography and more — book verified artists in Bangalore, Mumbai, Delhi and beyond.
        </AppText>
        <AppButton label="Get started" onPress={toLogin} />
        <AppButton label="I already have an account" variant="secondary" onPress={toLogin} />
      </View>
    </View>
  );
}
