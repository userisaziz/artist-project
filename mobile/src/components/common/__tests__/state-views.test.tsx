import { render, act } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import { View } from 'react-native';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { ThemeProvider } from '../../../core/theme/theme-provider';
import { LoadingView } from '../StateViews';
import { RefetchBar } from '../RefetchBar';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0, start: 0, end: 0 }),
}));

const wrap = (ui: ReactElement) => render(<ThemeProvider>{ui}</ThemeProvider>);

describe('LoadingView', () => {
  it('draws the shape of the content instead of a spinner in an empty page', async () => {
    const view = await wrap(<LoadingView label="Loading your orders" />);
    expect(view.getByLabelText('Loading your orders')).toBeTruthy();
    // The page is filled with the placeholder blocks, not one small spinner.
    expect(view.queryAllByLabelText('Loading').length).toBeGreaterThan(2);
  });

  it('keeps the bare spinner for a pagination footer, where placeholders would read as new rows', async () => {
    const view = await wrap(<LoadingView label="Loading more" shape="spinner" />);
    expect(view.getByLabelText('Loading more')).toBeTruthy();
    expect(view.queryAllByLabelText('Loading')).toHaveLength(0);
  });

  it('gives the sideways and detail shapes a silhouette too', async () => {
    for (const shape of ['tiles', 'icons', 'detail'] as const) {
      const view = await wrap(<LoadingView label="Loading artists near you" shape={shape} />);
      expect(view.getByLabelText('Loading artists near you')).toBeTruthy();
      expect(view.queryAllByLabelText('Loading').length).toBeGreaterThan(1);
    }
  });
});

describe('RefetchBar', () => {
  beforeEach(() => { jest.useFakeTimers(); });
  afterEach(() => { jest.useRealTimers(); });

  /** Mounted beside the bar: a query that stays in flight for `ms` before it answers. */
  function Probe({ ms = 0 }: { ms?: number }) {
    useQuery({
      queryKey: ['refetch-bar'],
      queryFn: async () => {
        if (ms) await new Promise((resolve) => setTimeout(resolve, ms));
        return 'done';
      },
    });
    return <View />;
  }

  const withClient = (ui: ReactNode) => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(<QueryClientProvider client={client}><ThemeProvider>{ui}</ThemeProvider></QueryClientProvider>);
  };

  /** Advance the fake clock, then drain one tick: a fetch that resolves mid-advance settles as a
   *  microtask, and react-query hands its observer notification to the store on the following tick. */
  const tick = async (ms: number) => {
    await act(async () => { jest.advanceTimersByTime(ms); });
    await act(async () => { jest.advanceTimersByTime(1); });
  };

  it('stays out of the way for a refetch that answers quickly', async () => {
    const view = await withClient(<><Probe ms={100} /><RefetchBar /></>);
    await tick(100);
    await tick(300); // past the show threshold: the pending timer was cancelled, not merely delayed
    expect(view.queryByLabelText('Refreshing')).toBeNull();
  });

  it('shows the indeterminate bar while a slow refetch runs, and takes it back when it settles', async () => {
    const view = await withClient(<><Probe ms={400} /><RefetchBar /></>);
    await tick(300);
    expect(view.getByLabelText('Refreshing')).toBeTruthy();
    await tick(600);
    expect(view.queryByLabelText('Refreshing')).toBeNull();
  });
});
