import { Stack } from 'expo-router';

// No index route in this group: tell the stack where an unauthenticated user lands.
export const unstable_settings = { initialRouteName: 'login' };

export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
