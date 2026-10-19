import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText, Accent } from '../../src/components/common/AppText';
import { AppButton } from '../../src/components/common/AppButton';
import { useTheme } from '../../src/core/theme/theme-provider';
import { useAuth } from '../../src/context/auth/auth-provider';
import { useArtistProfile } from '../../src/hooks/artist-onboarding/artist-onboarding';
import { useArtistFlow } from '../../src/context/artist-onboarding/flow-context';

// Atelier hi-fi "onbDone": the review timeline. A rejection shows the admin's reason and "Edit and resubmit" instead.
export default function InReviewScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const { data } = useArtistProfile();
  const { startEditing } = useArtistFlow();
  const rejected = data?.status === 'rejected';
  const suspended = data?.status === 'suspended';
  const submitted = data?.submitted_at
    ? new Date(data.submitted_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
    : '';
  const card = { marginTop: 26, borderRadius: 18, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.separator, padding: 16 } as const;

  return (
    <LinearGradient colors={[theme.colors.washTop, theme.colors.surface]} locations={[0, 0.6]} style={{ flex: 1 }}>
      <View style={{ flex: 1, paddingTop: insets.top + 64, paddingHorizontal: 24, paddingBottom: insets.bottom + 24 }}>
        <Svg width={56} height={36} viewBox="0 0 28 18" fill="none" stroke={theme.colors.accent} strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" style={{ alignSelf: 'center' }}>
          <Path d="M14 9C10 3 3 1 2 5s5 7 12 4zM14 9c4-6 11-8 12-4s-5 7-12 4z" />
          <Path d="M13 10l-3 7M15 10l3 7" />
        </Svg>
        <AppText variant="display" style={{ fontSize: 34, lineHeight: 36, letterSpacing: -0.85, color: theme.colors.heading, textAlign: 'center', marginTop: 18 }}>
          {rejected ? 'Your profile needs ' : 'Your profile is '}<Accent light color={theme.colors.brand}>{rejected ? 'a few changes' : suspended ? 'paused' : 'in review'}</Accent>
        </AppText>

        {suspended ? (
          <View style={[card, { gap: 6 }]}>
            <AppText variant="label" style={{ color: theme.colors.brand }}>Note from our team</AppText>
            <AppText variant="body" style={{ color: theme.colors.textPrimary }}>
              Your profile is hidden and you can’t take new bookings while we look into something. We’ll contact you about next steps.
            </AppText>
          </View>
        ) : rejected ? (
          <View style={[card, { gap: 6 }]}>
            <AppText variant="label" style={{ color: theme.colors.brand }}>Note from our team</AppText>
            <AppText variant="body" style={{ color: theme.colors.textPrimary }}>{data?.rejection_reason ?? 'Please review your profile and submit again.'}</AppText>
          </View>
        ) : (
          <>
            <AppText variant="body" style={{ fontSize: 14, lineHeight: 21, color: theme.colors.textSecondary, textAlign: 'center', marginTop: 12 }}>
              We check every artist so clients can book with confidence. This usually takes 24–48 hours.
            </AppText>
            <View style={[card, { gap: 16 }]}>
              <Milestone state="done" title="Profile submitted" detail={submitted} />
              <Milestone state="current" title="Identity & portfolio check" detail="In progress · usually 24–48 hrs" />
              <Milestone state="next" title="Go live" detail="Clients can find and book you" />
            </View>
          </>
        )}

        <View style={{ flex: 1 }} />
        <View style={{ gap: 8 }}>
          {rejected ? <AppButton label="Edit and resubmit" onPress={startEditing} /> : null}
          <AppButton label="Sign out" variant="ghost" onPress={() => { void signOut(); }} />
        </View>
      </View>
    </LinearGradient>
  );
}

function Milestone({ state, title, detail }: { state: 'done' | 'current' | 'next'; title: string; detail: string }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 12, opacity: state === 'next' ? 0.55 : 1 }}>
      <View
        style={{
          width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center',
          backgroundColor: state === 'done' ? theme.colors.brand : 'transparent',
          borderWidth: state === 'done' ? 0 : state === 'current' ? 2 : 1.5,
          borderColor: state === 'current' ? theme.colors.accent : theme.colors.border,
        }}
      >
        {state === 'done' ? <AppText style={{ fontSize: 13, color: theme.colors.textOnBrand }}>✓</AppText> : null}
        {state === 'current' ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.accent }} /> : null}
      </View>
      <View>
        <AppText variant="label" style={{ fontSize: 14, color: theme.colors.textPrimary }}>{title}</AppText>
        {detail ? <AppText variant="caption" style={{ color: theme.colors.textMuted }}>{detail}</AppText> : null}
      </View>
    </View>
  );
}
