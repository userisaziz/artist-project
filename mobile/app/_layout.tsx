import { useEffect } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import type { ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, PlusJakartaSans_600SemiBold_Italic, PlusJakartaSans_500Medium_Italic, PlusJakartaSans_700Bold, PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans';
import { ThemeProvider, useTheme } from '../src/theme/theme-provider';
import { AuthProvider, useAuth } from '../src/auth/auth-provider';
import { AppText } from '../src/components/AppText';
import { AppButton } from '../src/components/AppButton';
import type { User } from '../src/api/types';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ PlusJakartaSans_600SemiBold_Italic, PlusJakartaSans_500Medium_Italic, PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold });
  if (!fontsLoaded && !fontError) return null; // a font failure falls back to system fonts rather than a stuck splash
  return (
    <ThemeProvider>
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </ThemeProvider>
  );
}

function Gate() {
  const { status, user } = useAuth();
  const theme = useTheme();
  // Gate only mounts once fonts are settled, so this hides the native splash when both fonts and restore are done.
  useEffect(() => { if (status !== 'restoring') SplashScreen.hideAsync(); }, [status]);
  if (status === 'restoring') {
    return <View style={{ flex: 1, backgroundColor: theme.colors.background }} />;
  }
  const where = destination(status, user);
  // Protected screens: exactly one guard is true, so the stack always lands in one place, and
  // flipping a guard drops the old screens from history (no back-navigation across a boundary).
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.background } }}>
      <Stack.Protected guard={where === 'signup'}>
        <Stack.Screen name="signup" />
      </Stack.Protected>
      <Stack.Protected guard={where === 'role'}>
        <Stack.Screen name="choose-role" />
      </Stack.Protected>
      <Stack.Protected guard={where === 'home'}>
        <Stack.Screen name="index" />
      </Stack.Protected>
      <Stack.Protected guard={where === 'auth'}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}

type Destination = 'auth' | 'signup' | 'role' | 'home';

/** Where a user belongs, from the account state the server returns; home itself switches on `role`. */
function destination(status: 'unauthenticated' | 'authenticated', user: User | null): Destination {
  if (status !== 'authenticated' || !user) return 'auth';
  if (user.is_onboarded) return 'home';
  return user.first_name ? 'role' : 'signup';
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
