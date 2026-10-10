import { Stack } from 'expo-router';
import { useAuth } from '../../src/auth/auth-provider';

// Authenticated but not yet onboarded. The root gate hands this group the whole subtree;
// within it, exactly one guard is true so the stack always lands on one step:
// no name yet → sign up; name saved but no role yet → choose role.
export default function OnboardingLayout() {
  const { user } = useAuth();
  const needsDetails = !user?.first_name;
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={needsDetails}>
        <Stack.Screen name="signup" />
      </Stack.Protected>
      <Stack.Protected guard={!needsDetails}>
        <Stack.Screen name="choose-role" />
      </Stack.Protected>
    </Stack>
  );
}
