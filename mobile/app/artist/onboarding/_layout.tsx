import { Stack } from 'expo-router';
import { useTheme } from '../../../src/theme/theme-provider';

// Intro → Profile → Services → Portfolio. The artist layout guards the whole group; steps
// navigate with push (forward) and dismissTo (back), so a resumed step can still go back.
export default function OnboardingLayout() {
  const theme = useTheme();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.canvas } }} />;
}
