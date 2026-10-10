import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { Image } from 'expo-image';
import type { ImageContentPosition } from 'expo-image';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText, Accent } from '../../src/components/AppText';
import { useTheme } from '../../src/theme/theme-provider';
import { useAuth } from '../../src/auth/auth-provider';
import { errorMessage } from '../../src/api/error-message';

const CUSTOMER_PHOTO = require('../../assets/hero/role-customer.webp'); // design's role-client.jpg
const ARTIST_PHOTO = require('../../assets/hero/role-artist.webp');     // design's role-creator.jpg

type Choice = 'customer' | 'artist';

// Atelier hi-fi "Choose role" (v4): split cards, copy on the left, photo fading in from the right;
// tapping a card saves the role and the gate routes on.
export default function ChooseRoleScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { chooseRole } = useAuth();
  const [pending, setPending] = useState<Choice | null>(null);
  const [error, setError] = useState<string | null>(null);

  const choose = async (choice: Choice) => {
    if (pending) return;
    setPending(choice);
    setError(null);
    try {
      await chooseRole(choice);
    } catch (e) {
      setError(errorMessage(e));
      setPending(null);
    }
  };

  const back = () => (router.canGoBack() ? router.back() : router.replace('/signup'));

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.canvas }}
      contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + theme.spacing.xs, paddingHorizontal: theme.spacing.md, paddingBottom: Math.max(insets.bottom, theme.spacing.xl) }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 6, paddingHorizontal: theme.spacing.xs }}>
        <AppText variant="display" style={{ fontSize: 26.5, lineHeight: 28, letterSpacing: -0.66, color: theme.colors.heading }}>Atelier</AppText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={back}
          style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.separator, alignItems: 'center', justifyContent: 'center' }}
        >
          <AppText style={{ fontSize: 20, lineHeight: 24, color: theme.colors.textPrimary }}>‹</AppText>
        </Pressable>
      </View>
      <View style={{ paddingTop: 22, paddingHorizontal: theme.spacing.xs }}>
        <AppText variant="eyebrow" style={{ fontSize: 10.5, letterSpacing: 2.5, color: theme.colors.brand }}>ARTISTS / BEAUTY / YOU</AppText>
        <AppText variant="display" style={{ fontSize: 28, lineHeight: 30, letterSpacing: -0.7, color: theme.colors.heading, marginTop: 10 }}>
          {'What brings you '}<Accent light color={theme.colors.brand}>here?</Accent>
        </AppText>
      </View>

      <View style={{ gap: 14, marginTop: 22 }}>
        <RoleCard
          tone="light"
          image={CUSTOMER_PHOTO}
          imagePosition={{ left: '52%', top: '30%' }}
          tag="FOR CLIENTS"
          title={'Book an\nartist'}
          cta="Browse artists"
          busy={pending === 'customer'}
          disabled={pending !== null}
          onPress={() => { void choose('customer'); }}
        />
        <RoleCard
          tone="dark"
          image={ARTIST_PHOTO}
          imagePosition={{ left: '45%', top: '30%' }}
          tag="FOR CREATORS"
          title={'Offer my\nservices'}
          cta="Create your profile"
          busy={pending === 'artist'}
          disabled={pending !== null}
          onPress={() => { void choose('artist'); }}
        />
      </View>
      {error ? <AppText variant="caption" style={{ color: theme.colors.error, marginTop: theme.spacing.md, textAlign: 'center' }}>{error}</AppText> : null}

      <View style={{ flex: 1, minHeight: theme.spacing.md }} />
      <AppText variant="caption" style={{ textAlign: 'center', color: theme.colors.textMuted }}>You can switch roles anytime from your profile.</AppText>
    </ScrollView>
  );
}

interface RoleCardProps {
  tone: 'light' | 'dark'; // light: blush card, plum ink; dark: plum card, white ink
  image: number;
  imagePosition: ImageContentPosition;
  tag: string;
  title: string;
  cta: string;
  busy: boolean;
  disabled: boolean;
  onPress: () => void;
}

/** Split choice card: tag pill, title and a round-arrow CTA on the left; the photo (right 62%) fades in under a horizontal wash. */
function RoleCard({ tone, image, imagePosition, tag, title, cta, busy, disabled, onPress }: RoleCardProps) {
  const theme = useTheme();
  const dark = tone === 'dark';
  const white = theme.colors.textOnBrand;
  const ink = dark ? white : theme.colors.heading;
  const base = dark ? theme.colors.brandInk : theme.colors.roleCard;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title.replace('\n', ' ')}. ${cta}`}
      accessibilityState={{ disabled, busy }}
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => ({
        height: 236, borderRadius: 24, backgroundColor: base,
        ...theme.shadows.lg, shadowOpacity: dark ? 0.22 : 0.12, shadowRadius: 28, shadowOffset: { width: 0, height: 10 },
        opacity: pressed || (disabled && !busy) ? 0.9 : 1,
      })}
    >
      <View style={{ flex: 1, borderRadius: 24, overflow: 'hidden' }}>
        <Image source={image} contentFit="cover" contentPosition={imagePosition} style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: '62%', backgroundColor: theme.colors.imageFallback }} />
        <LinearGradient
          colors={[base, base, `${base}${dark ? 'BF' : 'CC'}`, `${base}00`]}
          locations={[0, 0.4, 0.55, 0.78]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          pointerEvents="none"
        />
        <View style={{ position: 'absolute', left: 18, top: 18, bottom: 18, width: '58%' }}>
          <View
            style={{
              alignSelf: 'flex-start', paddingHorizontal: 11, paddingVertical: 5, borderRadius: theme.radii.pill,
              backgroundColor: dark ? 'transparent' : theme.colors.roleTag, borderWidth: dark ? 1 : 0, borderColor: `${white}99`,
            }}
          >
            <AppText variant="eyebrow" style={{ fontSize: 10, lineHeight: 12, letterSpacing: 1.2, color: dark ? white : theme.colors.brandInk }}>{tag}</AppText>
          </View>
          <AppText variant="display" style={{ fontSize: 23.4, lineHeight: 23, letterSpacing: -0.58, color: ink, marginTop: 10 }}>{title}</AppText>
          <View style={{ flex: 1 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: dark ? white : theme.colors.brandInk }}>
              {busy ? (
                <ActivityIndicator size="small" color={dark ? theme.colors.brandInk : white} />
              ) : (
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={dark ? theme.colors.brandInk : white} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M5 12h14M13 6l6 6-6 6" />
                </Svg>
              )}
            </View>
            <AppText variant="label" style={{ fontSize: 13.5, fontFamily: theme.typography.eyebrow.fontFamily, color: dark ? white : theme.colors.brandInk }}>{cta}</AppText>
          </View>
        </View>
      </View>
    </Pressable>
  );
}
