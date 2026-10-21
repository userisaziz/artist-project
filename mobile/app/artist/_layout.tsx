import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { useTheme } from '../../src/core/theme/theme-provider';
import { AppText } from '../../src/components/common/AppText';
import { AppButton } from '../../src/components/common/AppButton';
import { useArtistProfile } from '../../src/hooks/artist-onboarding/artist-onboarding';
import { artistStage } from '../../src/utils/artist-onboarding/routing';
import { ArtistFlowContext } from '../../src/context/artist-onboarding/flow-context';
import { errorMessage } from '../../src/core/api/error-message';

// Artist area. The root guards the folder (role === 'artist'); inside it, the cached
// GET /artists/me picks exactly one area, like the root gate. `index` is the always-mounted
// hub: when a guard flips (submit, Edit and resubmit, approval), the router falls back to it
// and it redirects to the new area.
export default function ArtistLayout() {
  const theme = useTheme();
  const profile = useArtistProfile();
  const [editing, setEditing] = useState(false);
  const status = profile.data?.status;
  // Reset during render (no effect): editing lasts while rejected, or while a reopened profile is a draft.
  if (editing && status !== 'rejected' && status !== 'draft' && status !== 'approved') setEditing(false);
  const flow = useMemo(() => ({ editing, startEditing: () => setEditing(true) }), [editing]);

  if (profile.isPending) return <View style={{ flex: 1, backgroundColor: theme.colors.canvas }} />;
  if (profile.isError && profile.data === undefined) { // a failed background refetch keeps the cached profile and the mounted stack
    return (
      <View style={{ flex: 1, justifyContent: 'center', gap: theme.spacing.lg, padding: theme.spacing.lg, backgroundColor: theme.colors.canvas }}>
        <AppText variant="body" style={{ color: theme.colors.textPrimary, textAlign: 'center' }}>{errorMessage(profile.error)}</AppText>
        <AppButton label="Try again" onPress={() => { void profile.refetch(); }} />
      </View>
    );
  }
  const stage = artistStage(profile.data ?? null, editing);
  return (
    <ArtistFlowContext.Provider value={flow}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.canvas } }}>
        <Stack.Screen name="index" />
        <Stack.Protected guard={stage === 'onboarding'}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>
        <Stack.Protected guard={stage === 'review'}>
          <Stack.Screen name="in-review" />
        </Stack.Protected>
        <Stack.Protected guard={stage === 'live'}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="public-profile" />
          <Stack.Screen name="reviews" />
          <Stack.Screen name="services" />
          <Stack.Screen name="chat/[id]" />
          <Stack.Screen name="posts/index" />
          <Stack.Screen name="posts/new" />
          <Stack.Screen name="shop/index" />
          <Stack.Screen name="shop/new-product" />
          <Stack.Screen name="shop/settings" />
          <Stack.Screen name="shop/[id]" />
          <Stack.Screen name="notifications" />
          <Stack.Screen name="booking/[id]" />
          <Stack.Screen name="support/index" />
          <Stack.Screen name="support/[id]" />
          <Stack.Screen name="working-hours" />
        </Stack.Protected>
      </Stack>
    </ArtistFlowContext.Provider>
  );
}
