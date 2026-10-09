import { useEffect } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import type { ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, CormorantGaramond_600SemiBold, CormorantGaramond_600SemiBold_Italic } from '@expo-google-fonts/cormorant-garamond';
import { PlusJakartaSans_700Bold, PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans';
import { ThemeProvider, useTheme } from '../src/theme/theme-provider';
import { AuthProvider, useAuth } from '../src/auth/auth-provider';
import { AppText } from '../src/components/AppText';
import { AppButton } from '../src/components/AppButton';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ CormorantGaramond_600SemiBold, CormorantGaramond_600SemiBold_Italic, PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold });
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
  const { status } = useAuth();
  const theme = useTheme();
  // Gate only mounts once fonts are settled, so this hides the native splash when both fonts and restore are done.
  useEffect(() => { if (status !== 'restoring') SplashScreen.hideAsync(); }, [status]);
  if (status === 'restoring') {
    return <View style={{ flex: 1, backgroundColor: theme.colors.background }} />;
  }
  // Protected groups: a group whose guard is false is unreachable, and flipping a guard
  // drops its screens from history — no back-navigation across the auth boundary.
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.background } }}>
      <Stack.Protected guard={status === 'authenticated'}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={status === 'unauthenticated'}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
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
