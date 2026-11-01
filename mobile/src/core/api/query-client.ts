import { AppState, Platform } from 'react-native';
import { QueryClient, focusManager } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      // A minute: long enough that moving between screens does not refetch, short enough that what a
      // screen shows is never badly out of date.
      staleTime: 60_000,
      // Half an hour instead of the 5-minute default. The default threw the data away on navigation,
      // so returning to a screen paid for its requests all over again.
      gcTime: 30 * 60_000,
    },
  },
});

// React Native has no window focus: coming back to the app counts as focus, so In review picks up a decision.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => focusManager.setFocused(state === 'active'));
}
