import { Stack } from 'expo-router';
import { useTheme } from '../../src/core/theme/theme-provider';
import { BookingFlowProvider } from '../../src/context/bookings/flow-context';

// Customer area. Guarded at the root (role === 'customer'), so anything mounted here is customer-only.
// The tabs sit at the bottom of this stack; the storefront and the booking flow are pushed above them.
export default function CustomerLayout() {
  const theme = useTheme();
  return (
    <BookingFlowProvider>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.background } }} />
    </BookingFlowProvider>
  );
}
