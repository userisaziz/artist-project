import { useEffect } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import type { ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, PlayfairDisplay_700Bold } from '@expo-google-fonts/playfair-display';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { ThemeProvider, useTheme } from '../src/theme/theme-provider';
import { AuthProvider, useAuth } from '../src/auth/auth-provider';
import { AppText } from '../src/components/AppText';
import { AppButton } from '../src/components/AppButton';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ PlayfairDisplay_700Bold, Inter_400Regular, Inter_500Medium, Inter_600SemiBold });
  useEffect(() => { if (fontsLoaded) SplashScreen.hideAsync(); }, [fontsLoaded]);
  if (!fontsLoaded) return null;
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
