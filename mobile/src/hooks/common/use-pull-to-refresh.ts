import { useCallback, useState } from 'react';

/** Pull-to-refresh for a list: the spinner shows only while the user's own pull is loading, never for a background
 *  poll or refocus. A failed reload is shown by the screen's own error state (react-query keeps it). */
export function usePullToRefresh(refetch: () => Promise<unknown>) {
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // The failure itself is the screen's to show (its query's error state), so here it only ends the spinner.
    void refetch().catch(() => undefined).finally(() => setRefreshing(false));
  }, [refetch]);
  return { refreshing, onRefresh };
}
