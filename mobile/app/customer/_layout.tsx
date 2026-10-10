import { Stack } from 'expo-router';

// Customer area stack. Guarded at the root (role === 'customer'), so anything mounted here is
// customer-only. Future screens (browse, orders) are added as siblings — paths stay under /customer.
export default function CustomerLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
