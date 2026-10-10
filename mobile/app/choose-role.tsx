import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import type { ImageContentPosition } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Rect } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText, Accent } from '../src/components/AppText';
import { useTheme } from '../src/theme/theme-provider';
import { useAuth } from '../src/auth/auth-provider';
import { errorMessage } from '../src/api/error-message';

const CUSTOMER_PHOTO = require('../assets/hero/role-customer.webp'); // client being made up
const ARTIST_PHOTO = require('../assets/hero/role-artist.webp');     // artist with her portfolio
const ICON_CALENDAR = ['M3 10h18M8 3v4M16 3v4', 'M12 18.5s-3-1.8-3-3.6a1.5 1.5 0 0 1 3-.4 1.5 1.5 0 0 1 3 .4c0 1.8-3 3.6-3 3.6z'];
const ICON_BRIEFCASE = ['M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3 12.5h18M11 12.5v2h2v-2'];

type Choice = 'customer' | 'artist';

// Atelier hi-fi "Choose role" (v3, full-photo cards); tapping one saves the role and the gate routes on.
export default function ChooseRoleScreen() {
  const theme = useTheme();
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

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient colors={[theme.colors.washTop, theme.colors.washBottom]} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
      <View style={{ flex: 1, paddingTop: insets.top + theme.spacing.xs, paddingHorizontal: theme.spacing.md, paddingBottom: insets.bottom + theme.spacing.sm }}>
        <View style={{ paddingHorizontal: theme.spacing.xs, paddingTop: theme.spacing.xs }}>
          <AppText variant="title" style={{ fontSize: 20.3, lineHeight: 24, letterSpacing: -0.5, color: theme.colors.brandInk }}>Atelier</AppText>
          <AppText variant="display" style={{ fontSize: 29.6, lineHeight: 29.6, letterSpacing: -0.74, color: theme.colors.textPrimary, marginTop: theme.spacing.lg + 6 }}>
            {'What brings you '}<Accent light color={theme.colors.accent}>here?</Accent>
          </AppText>
        </View>

        <RoleCard
          primary
          image={CUSTOMER_PHOTO}
          imagePosition={{ left: '55%', top: '30%' }}
          icon={ICON_CALENDAR}
          iconRect={{ y: 5, height: 16 }}
          title="Book an artist"
          description="Browse portfolios, compare reviews and book in minutes."
          cta="Find artists"
          busy={pending === 'customer'}
          disabled={pending !== null}
          onPress={() => { void choose('customer'); }}
        />
        <RoleCard
          image={ARTIST_PHOTO}
          imagePosition={{ left: '62%', top: '22%' }}
          icon={ICON_BRIEFCASE}
          iconRect={{ y: 7, height: 13 }}
          title="Offer my services"
          description="Showcase your work, set your prices and get booked."
          cta="Get started"
          busy={pending === 'artist'}
          disabled={pending !== null}
          onPress={() => { void choose('artist'); }}
        />
        {error ? <AppText variant="caption" style={{ color: theme.colors.error, marginTop: theme.spacing.md, textAlign: 'center' }}>{error}</AppText> : null}

        <View style={{ flex: 1, minHeight: 14 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: theme.spacing.md }}>
          <View style={{ width: 60, height: 1, backgroundColor: theme.colors.border }} />
          <Svg width={22} height={14} viewBox="0 0 28 18" fill="none" stroke={theme.colors.accent} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M14 9C10 3 3 1 2 5s5 7 12 4zM14 9c4-6 11-8 12-4s-5 7-12 4z" />
            <Path d="M13 10l-3 7M15 10l3 7" />
          </Svg>
          <View style={{ width: 60, height: 1, backgroundColor: theme.colors.border }} />
        </View>
      </View>
    </View>
  );
}

interface RoleCardProps {
  primary?: boolean; // first card: solid white CTA; second: outlined glass CTA
  image: number;
  imagePosition: ImageContentPosition;
  icon: string[];
  iconRect: { y: number; height: number };
  title: string;
  description: string;
  cta: string;
  busy: boolean;
  disabled: boolean;
  onPress: () => void;
}

/** Full-photo choice card: deep plum fade under white title, description and a pill CTA with a round arrow. */
function RoleCard({ primary = false, image, imagePosition, icon, iconRect, title, description, cta, busy, disabled, onPress }: RoleCardProps) {
  const theme = useTheme();
  const white = theme.colors.textOnBrand;
  const scrim = theme.colors.photoScrim;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${cta}`}
      accessibilityState={{ disabled, busy }}
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => ({
        marginTop: primary ? 18 : theme.spacing.md - theme.spacing.xs,
        height: 262, borderRadius: 24, backgroundColor: theme.colors.imageFallback,
        ...theme.shadows.lg, shadowOpacity: 0.18, shadowRadius: 30, shadowOffset: { width: 0, height: 10 },
        opacity: pressed || (disabled && !busy) ? 0.9 : 1,
      })}
    >
      <View style={{ flex: 1, borderRadius: 24, overflow: 'hidden' }}>
        <Image source={image} contentFit="cover" contentPosition={imagePosition} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
        <LinearGradient
          colors={[`${scrim}00`, `${theme.colors.brandInk}8C`, `${scrim}E6`, `${scrim}F5`]}
          locations={[0.1, 0.38, 0.62, 1]}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          pointerEvents="none"
        />
        <View style={{ position: 'absolute', left: theme.spacing.md, right: theme.spacing.md, bottom: theme.spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: `${white}38`, borderWidth: 1, borderColor: `${white}66`, alignItems: 'center', justifyContent: 'center' }}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={white} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
                <Rect x={3} y={iconRect.y} width={18} height={iconRect.height} rx={3} />
                {icon.map((d) => <Path key={d} d={d} />)}
              </Svg>
            </View>
            <AppText variant="title" style={{ fontSize: 20.3, lineHeight: 20.3, letterSpacing: -0.5, color: white }}>{title}</AppText>
          </View>
          <AppText variant="caption" style={{ fontSize: 12.5, lineHeight: 18, color: white, marginTop: theme.spacing.sm, maxWidth: 270 }}>{description}</AppText>
          <View
            style={{
              marginTop: theme.spacing.md - theme.spacing.xs, height: 42, borderRadius: theme.radii.pill, borderWidth: 1,
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: theme.spacing.md, paddingRight: 6,
              backgroundColor: primary ? white : `${white}2E`, borderColor: primary ? white : `${white}8C`,
            }}
          >
            <AppText variant="label" style={{ fontSize: 13, fontFamily: theme.typography.eyebrow.fontFamily, color: primary ? theme.colors.brandInk : white }}>{cta}</AppText>
            <View style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: primary ? theme.colors.brand : white }}>
              {busy ? (
                <ActivityIndicator size="small" color={primary ? white : theme.colors.brandInk} />
              ) : (
                <AppText style={{ fontSize: 14, lineHeight: 18, color: primary ? white : theme.colors.brandInk }}>→</AppText>
              )}
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
}
