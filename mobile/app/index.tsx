import { Redirect } from 'expo-router';
import { useAuth } from '../src/context/auth/auth-provider';
import { destination, landingHref } from '../src/utils/auth/routing';

// `/` boot target: forwards to the one area the gate is currently showing. Keeping the decision
// in shared `destination()`/`landingHref()` means this hub and the root guards can never disagree.
export default function Index() {
  const { status, user } = useAuth();
  if (status === 'restoring') return null; // Gate keeps the splash up until restore settles
  return <Redirect href={landingHref(destination(status, user), user)} />;
}
