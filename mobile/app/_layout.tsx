import { useCallback, useEffect } from 'react';
import { View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import type { ErrorBoundaryProps, Href } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, PlusJakartaSans_600SemiBold_Italic, PlusJakartaSans_500Medium_Italic, PlusJakartaSans_700Bold, PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans';
import { ThemeProvider, useTheme } from '../src/core/theme/theme-provider';
import { AuthProvider, useAuth } from '../src/context/auth/auth-provider';
import { destination } from '../src/utils/auth/routing';
import { AppText } from '../src/components/common/AppText';
import { AppButton } from '../src/components/common/AppButton';
import { SessionUnavailable } from '../src/components/auth/SessionUnavailable';
import { ToastHost } from '../src/components/common/Toast';
import { RefetchBar } from '../src/components/common/RefetchBar';
import { usePushNotifications } from '../src/hooks/notifications/use-push';
import { usePrefetchCatalog } from '../src/hooks/catalog/catalog';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { queryClient } from '../src/core/api/query-client';
import { CACHE_BUSTER, queryPersister } from '../src/core/api/persister';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ PlusJakartaSans_600SemiBold_Italic, PlusJakartaSans_500Medium_Italic, PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold });
  if (!fontsLoaded && !fontError) return null; // a font failure falls back to system fonts rather than a stuck splash
  return (
    <ThemeProvider>
      <View style={{ flex: 1 }}>
        {/* The cache is kept on the device between runs, so a cold start paints the last run's answers
            instead of a skeleton. The persisted copy is thrown away whenever the API's shapes change
            (CACHE_BUSTER) and whenever it cannot be read. */}
        <PersistQueryClientProvider client={queryClient} persistOptions={{ persister: queryPersister, buster: CACHE_BUSTER }}>
          <AuthProvider>
            <Gate />
          </AuthProvider>
        </PersistQueryClientProvider>
        <ToastHost />
      </View>
    </ThemeProvider>
  );
}

function Gate() {
  const { status, user, retryRestore } = useAuth();
  const theme = useTheme();
  const router = useRouter();
  const openLink = useCallback((link: string) => router.push(link as Href), [router]);
  usePushNotifications(openLink);
  // The catalog is on nearly every screen: warming it here means the first one opens on data
  // instead of a spinner, and the requests overlap with the session restore above.
  usePrefetchCatalog();
  // Gate only mounts once fonts are settled, so this hides the native splash when both fonts and restore are done.
  useEffect(() => { if (status !== 'restoring') SplashScreen.hideAsync(); }, [status]);
  if (status === 'restoring') {
    return <View style={{ flex: 1, backgroundColor: theme.colors.background }} />;
  }
  // The saved session could not be checked (offline / server down): retry rather than dropping to login.
  if (status === 'unavailable') return <SessionUnavailable onRetry={retryRestore} />;
  const where = destination(status, user);
  // `/` is the always-mounted redirect hub (app/index.tsx) so Expo Router has a concrete boot
  // target; it forwards into exactly one guarded area below. Flipping a guard drops the old
  // area from history, so there is no back-navigation across a boundary.
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.background } }}>
        <Stack.Screen name="index" />
        <Stack.Protected guard={where === 'auth'}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Protected guard={where === 'onboarding'}>
          <Stack.Screen name="(onboarding)" />
        </Stack.Protected>
        <Stack.Protected guard={where === 'customer'}>
          <Stack.Screen name="customer" />
        </Stack.Protected>
        <Stack.Protected guard={where === 'artist'}>
          <Stack.Screen name="artist" />
        </Stack.Protected>
      </Stack>
      {/* Above every route, and a leaf with its own query subscription: a background refetch on resume
          re-renders this bar, never the navigator under it. */}
      <RefetchBar />
    </View>
  );
}

// May render outside ThemeProvider; useTheme() then falls back to the light theme via context default.
export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  const theme = useTheme();
  return (
    <View style={{ flex: 1, justifyContent: 'center', gap: theme.spacing.lg, padding: theme.spacing.lg, backgroundColor: theme.colors.background }}>
      <AppText variant="title" style={{ color: theme.colors.textPrimary, textAlign: 'center' }}>Something went wrong</AppText>
      <AppButton label="Try again" onPress={() => { void retry(); }} />
    </View>
  );
}
